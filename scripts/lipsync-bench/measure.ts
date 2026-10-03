// Measure how well dubbed tracks follow the source speech of the prepared video.
// Each argument is a track name from run.ts (data/<name>.wav) or a path to any
// video/audio file (e.g. a video produced by the app).
//
// Usage: npx tsx scripts/lipsync-bench/measure.ts <name|file>... [--lang it]
//
// Metrics:
// - anchorDrift*: numbers and capitalized names are the same in both
//   languages; the dub is transcribed with Whisper and each anchor's time is
//   compared with the source. The fairest content-sync measure.
// - onset*: after each real pause in the source audio, how far the dub's
//   speech onset is from the moment the speaker resumes.
// - talkDuringSourcePauses: share of the source's pauses covered by dub speech.
//   Note: pauses are detected like the pipeline does, which slightly favors it.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';
import { WhisperService } from '../../src/backend/services/WhisperService';
import { JobLogger } from '../../src/backend/utils/logger';
import { dataDir, loadTranscript, argValue, ffmpeg, duration } from './common';

dotenv.config({ quiet: true });

type Seg = { start: number; end: number; text: string };
type Interval = [number, number];

const percentile = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const total = (xs: Interval[]) => xs.reduce((s, [a, b]) => s + b - a, 0);

/** Speech intervals = complement of the silences ffmpeg detects. */
function speech(wav: string, noise: string, minSilence: number): Interval[] {
  const log = spawnSync('ffmpeg', ['-hide_banner', '-i', wav, '-af', `silencedetect=noise=${noise}:d=${minSilence}`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const end = duration(wav);
  const silences: Interval[] = [];
  let start: number | null = null;
  for (const line of log.split('\n')) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    if (s) start = Math.max(0, parseFloat(s[1]));
    const e = line.match(/silence_end: ([\d.]+)/);
    if (e && start !== null) { silences.push([start, parseFloat(e[1])]); start = null; }
  }
  if (start !== null) silences.push([start, end]);

  const result: Interval[] = [];
  let cursor = 0;
  for (const [a, b] of silences) {
    if (a > cursor + 0.01) result.push([cursor, a]);
    cursor = b;
  }
  if (cursor < end - 0.01) result.push([cursor, end]);
  return result;
}

function overlap(a: Interval[], b: Interval[]): number {
  let i = 0, j = 0, o = 0;
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i][0], b[j][0]);
    const hi = Math.min(a[i][1], b[j][1]);
    if (hi > lo) o += hi - lo;
    if (a[i][1] < b[j][1]) i++; else j++;
  }
  return o;
}

/** Numbers and non-sentence-initial capitalized words, timed by interpolation inside their segment. */
function anchors(segs: Seg[]): Array<{ key: string; t: number }> {
  const result: Array<{ key: string; t: number }> = [];
  for (const s of segs) {
    const re = /\b(\d[\d.,]*|[A-Z][a-zà-ÿ]{2,})\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s.text))) {
      const before = s.text.slice(0, m.index).trimEnd();
      if (/[A-Z]/.test(m[1][0]) && (before === '' || /[.!?:"]$/.test(before))) continue;
      const t = s.start + (s.end - s.start) * (m.index / Math.max(1, s.text.length));
      result.push({ key: m[1].replace(/[.,]$/, '').toLowerCase(), t });
    }
  }
  return result;
}

/** Resolve an argument to a 44.1kHz WAV inside data/ and a short label. */
function resolveTrack(arg: string): { label: string; wav: string } {
  const named = path.join(dataDir, `${arg}.wav`);
  if (fs.existsSync(named)) return { label: arg, wav: named };
  if (!fs.existsSync(arg)) {
    console.error(`Not found: ${arg} (neither data/${arg}.wav nor a file path)`);
    process.exit(1);
  }
  const label = path.basename(arg, path.extname(arg));
  const wav = path.join(dataDir, `measure_${label}.wav`);
  ffmpeg(['-i', arg, '-vn', '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', '-y', wav]);
  return { label, wav };
}

async function transcribeDub(label: string, wav: string, language: string): Promise<Seg[]> {
  const cache = path.join(dataDir, `asr_${label}.json`);
  if (fs.existsSync(cache) && fs.statSync(cache).mtimeMs > fs.statSync(wav).mtimeMs) {
    return JSON.parse(fs.readFileSync(cache, 'utf8'));
  }
  const dir = path.join(dataDir, `asr_${label}`);
  fs.mkdirSync(dir, { recursive: true });
  const wav16 = path.join(dir, 'audio.wav');
  ffmpeg(['-i', wav, '-ar', '16000', '-ac', '1', '-y', wav16]);
  const result = await new WhisperService(new JobLogger(`lipsync-bench-asr-${label}`)).transcribe(wav16, language, true);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.writeFileSync(cache, JSON.stringify(result.segments || []));
  return result.segments || [];
}

async function evaluate(label: string, wav: string, language: string, srcSegs: Seg[]) {
  const dub = speech(wav, '-40dB', 0.12);

  // Real pauses in the source audio (Whisper.cpp segments are contiguous)
  const src = speech(path.join(dataDir, 'audio.wav'), '-35dB', 0.3);
  const pauses: Interval[] = [];
  for (let i = 1; i < src.length; i++) pauses.push([src[i - 1][1], src[i][0]]);
  const onsets = dub.map(([a]) => a);
  const onsetErr = pauses.map(([, resume]) => Math.min(...onsets.map(o => Math.abs(o - resume))));

  const srcSpeech: Interval[] = srcSegs.map(s => [s.start, s.end]);
  const covered = overlap(srcSpeech, dub);

  // Match each source anchor to the same token in the dub, in order, within ±25s
  const dubAnchors = anchors(await transcribeDub(label, wav, language));
  const srcAnchors = anchors(srcSegs);
  const used = new Set<number>();
  const drift: number[] = [];
  for (const a of srcAnchors) {
    let best = -1;
    let bestDiff = 25;
    dubAnchors.forEach((b, k) => {
      const diff = Math.abs(b.t - a.t);
      if (!used.has(k) && b.key === a.key && diff < bestDiff) { bestDiff = diff; best = k; }
    });
    if (best >= 0) { used.add(best); drift.push(bestDiff); }
  }

  return {
    track: label,
    durationSec: +duration(wav).toFixed(2),
    anchorsMatched: `${drift.length}/${srcAnchors.length}`,
    anchorDriftMedian: +percentile(drift, 0.5).toFixed(2),
    anchorDriftP90: +percentile(drift, 0.9).toFixed(2),
    anchorDriftMean: +mean(drift).toFixed(2),
    onsetErrMedian: +percentile(onsetErr, 0.5).toFixed(2),
    onsetsWithin300ms: `${onsetErr.filter(e => e <= 0.3).length}/${pauses.length}`,
    talkDuringSourcePauses: (100 * overlap(pauses, dub) / Math.max(0.001, total(pauses))).toFixed(1) + '%',
    srcSpeechCovered: (100 * covered / total(srcSpeech)).toFixed(1) + '%'
  };
}

(async () => {
  const args = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--lang');
  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/lipsync-bench/measure.ts <name|file>... [--lang it]');
    process.exit(1);
  }
  const language = argValue('--lang', 'it');
  const transcript = loadTranscript();

  const rows = [];
  for (const arg of args) {
    const { label, wav } = resolveTrack(arg);
    rows.push(await evaluate(label, wav, language, transcript.segments));
  }
  console.table(rows);
})().catch((e) => { console.error(e); process.exit(1); });
