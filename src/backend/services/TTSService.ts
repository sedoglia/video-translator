import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { JobLogger } from '../utils/logger';
import { LANGUAGES } from '../../shared/types';
import type { TimedText } from '../utils/speech-groups';
import ffmpeg from 'fluent-ffmpeg';
import { EdgeTTS } from '@andresaya/edge-tts';

interface AudioSegment {
  text: string;
  duration: number;
  silenceDuration: number;
}

interface SynthesizedClip {
  file: string;
  duration: number;
  rate: number; // Edge TTS rate in percent used for this clip
}

// Timeline tuning for aligned synthesis. Edge TTS's own rate control sounds
// far more natural than atempo, so it does the heavy lifting; atempo only
// absorbs the residual mismatch within a range where it stays transparent.
const MAX_TTS_RATE = 40;          // max Edge TTS speed-up, percent
const RESYNTH_THRESHOLD = 1.08;   // re-synthesize faster above this overflow
const MAX_SPEEDUP_TEMPO = 1.15;   // max atempo speed-up
const MIN_SLOWDOWN_TEMPO = 0.9;   // max atempo slow-down
const MIN_PAUSE = 0.15;           // keep at least this gap before the next phrase
const TTS_CONCURRENCY = 4;

export class TTSService {
  constructor(private logger: JobLogger) {}

  /**
   * @param alignedSegments translated phrases carrying the start/end time of
   *   the source speech they replace. When present, each phrase is placed at
   *   its own timestamp (lip-sync); otherwise the text is spread over the
   *   original duration.
   */
  async synthesize(
    text: string,
    targetLanguage: string,
    outputPath: string,
    originalAudioPath?: string,
    alignedSegments?: TimedText[]
  ): Promise<string> {
    this.logger.stage('SYNTHESIZING', `Generating TTS for language: ${targetLanguage}`);

    try {
      const tempDir = path.dirname(outputPath);
      const tempAudioPath = path.join(tempDir, 'tts_temp.mp3');

      // Get Edge TTS voice for language
      const voice = this.getEdgeVoiceForLanguage(targetLanguage);

      this.logger.debug('Generating speech with Edge TTS', {
        voice,
        textLength: text.length,
        alignedSegments: alignedSegments?.length || 0
      });

      const hasValidTimestamps = !!alignedSegments && alignedSegments.length > 0 &&
        alignedSegments.every(seg =>
          typeof seg.start === 'number' && !isNaN(seg.start) &&
          typeof seg.end === 'number' && !isNaN(seg.end)
        );

      if (originalAudioPath && fs.existsSync(originalAudioPath) && hasValidTimestamps) {
        this.logger.info('Using timestamp-anchored lip-sync with translated segments');
        try {
          await this.synthesizeAligned(alignedSegments!, voice, originalAudioPath, tempDir, outputPath);
        } catch (error: any) {
          this.logger.warn('Timestamp-anchored synthesis failed, falling back to intelligent segmentation', {
            error: error.message
          });
          await this.synthesizeWithIntelligentSegmentation(text, voice, originalAudioPath, tempDir, outputPath);
        }
      } else if (originalAudioPath && fs.existsSync(originalAudioPath)) {
        this.logger.info('Using intelligent segmentation for lip-sync (no timestamps)');
        await this.synthesizeWithIntelligentSegmentation(text, voice, originalAudioPath, tempDir, outputPath);
      } else {
        // No original audio, generate normally
        await this.generateSpeechEdgeTTS(text, voice, tempAudioPath);
        await this.convertToWav(tempAudioPath, outputPath);

        if (fs.existsSync(tempAudioPath)) {
          fs.unlinkSync(tempAudioPath);
        }
      }

      this.logger.stage('SYNTHESIZING', `TTS synthesis complete: ${outputPath}`);

      return outputPath;
    } catch (error: any) {
      this.logger.error('TTS synthesis failed', { error: error.message });
      throw new Error(`TTS synthesis failed: ${error.message}`);
    }
  }

  /**
   * Synthesize with intelligent segmentation for better lip-sync
   * Segments text based on punctuation and matches timing to original audio
   */
  private async synthesizeWithIntelligentSegmentation(
    text: string,
    voice: string,
    originalAudioPath: string,
    tempDir: string,
    outputPath: string
  ): Promise<void> {
    this.logger.debug('Using intelligent segmentation for better lip-sync');

    // Get original audio duration
    const originalDuration = await this.getAudioDuration(originalAudioPath);

    // Segment text intelligently
    const segments = this.segmentTextIntelligently(text);
    this.logger.debug('Text segmented', {
      segments: segments.length,
      originalDuration
    });

    // Calculate target duration per segment (proportional to text length)
    const totalTextLength = segments.reduce((sum, seg) => sum + seg.length, 0);

    // Generate TTS for each segment
    const segmentAudioFiles: string[] = [];
    let currentTime = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentFile = path.join(tempDir, `segment_${i}.mp3`);
      const segmentWav = path.join(tempDir, `segment_${i}.wav`);

      // Generate TTS for this segment
      await this.generateSpeechEdgeTTS(segment, voice, segmentFile);

      // Convert to WAV
      await this.convertToWav(segmentFile, segmentWav);

      // Get actual duration
      const segmentDuration = await this.getAudioDuration(segmentWav);

      // Calculate target duration based on proportion of text
      const textProportion = segment.length / totalTextLength;
      const targetDuration = originalDuration * textProportion;

      // Apply time-stretch if needed
      const stretchedFile = path.join(tempDir, `stretched_${i}.wav`);
      if (Math.abs(targetDuration - segmentDuration) / targetDuration > 0.05) {
        await this.timeStretchAudio(segmentWav, stretchedFile, targetDuration, segmentDuration);
        segmentAudioFiles.push(stretchedFile);

        // Clean up intermediate files
        fs.unlinkSync(segmentWav);
      } else {
        segmentAudioFiles.push(segmentWav);
      }

      // Clean up MP3
      fs.unlinkSync(segmentFile);

      currentTime += targetDuration;
    }

    // Concatenate all segments
    await this.concatenateAudioFiles(segmentAudioFiles, outputPath);

    // Final time-stretch to match exact duration
    const finalDuration = await this.getAudioDuration(outputPath);
    if (Math.abs(finalDuration - originalDuration) / originalDuration > 0.02) {
      const adjustedFile = path.join(tempDir, 'final_adjusted.wav');
      await this.timeStretchAudio(outputPath, adjustedFile, originalDuration, finalDuration);
      fs.copyFileSync(adjustedFile, outputPath);
      fs.unlinkSync(adjustedFile);
    }

    // Clean up segment files
    segmentAudioFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    this.logger.debug('Segmented synthesis complete', {
      originalDuration,
      finalDuration: await this.getAudioDuration(outputPath)
    });
  }

  /**
   * Timestamp-anchored synthesis: every translated phrase starts at the time
   * its source phrase starts in the original audio.
   *
   * Positions are absolute — a phrase that runs long delays only what follows
   * until the next pause absorbs it, instead of shifting the rest of the video.
   * A phrase that does not fit its slot may also use the pause after it before
   * being sped up, and speed-up goes through Edge TTS's rate first (natural
   * prosody) and atempo only for the small residual.
   */
  private async synthesizeAligned(
    segments: TimedText[],
    voice: string,
    originalAudioPath: string,
    tempDir: string,
    outputPath: string
  ): Promise<void> {
    const totalDuration = await this.getAudioDuration(originalAudioPath);
    const workDir = path.join(tempDir, 'tts_segments');
    fs.mkdirSync(workDir, { recursive: true });

    segments = await this.snapToSourcePauses(segments, originalAudioPath);

    this.logger.info('Starting timestamp-anchored synthesis', {
      segments: segments.length,
      totalDuration: totalDuration.toFixed(2)
    });

    // Time each phrase may occupy: its own speech plus the pause that follows,
    // minus a minimal gap so consecutive phrases don't run into each other.
    const slotFor = (i: number, start: number): { speech: number; max: number } => {
      const seg = segments[i];
      const nextStart = i + 1 < segments.length ? segments[i + 1].start : totalDuration;
      const speech = Math.max(0.1, seg.end - start);
      return { speech, max: Math.max(speech, nextStart - start - MIN_PAUSE) };
    };

    // 1. Synthesize every phrase at natural speed, then re-synthesize faster
    //    the ones that would overflow their slot even using the next pause.
    const clips: Array<SynthesizedClip | null> = new Array(segments.length).fill(null);
    let resynthesized = 0;
    await this.runPool(segments.length, TTS_CONCURRENCY, async (i) => {
      const text = segments[i].text.trim();
      if (!text) return;

      let clip = await this.synthesizeClip(text, voice, path.join(workDir, `seg_${i}`), 0);
      // Aim for the phrase's own speech plus half of the following pause, so
      // pauses stay audible unless the translation is much longer.
      const slot = slotFor(i, segments[i].start);
      const overflow = clip.duration / (slot.speech + (slot.max - slot.speech) / 2);
      if (overflow > RESYNTH_THRESHOLD) {
        const rate = Math.min(MAX_TTS_RATE, Math.ceil((overflow - 1) * 100));
        clip = await this.synthesizeClip(text, voice, path.join(workDir, `seg_${i}`), rate);
        resynthesized++;
      }
      clips[i] = clip;
    });

    // 2. Lay phrases on the timeline at their absolute start, fitting each one
    //    into the time actually left (it shrinks if the previous phrase ran late).
    const timeline: string[] = [];
    let cursor = 0;
    let silenceIndex = 0;
    let stretchedCount = 0;
    let maxTempo = 1;
    let minTempo = 1;
    let maxLateness = 0;
    let totalLateness = 0;

    const pushSilence = async (duration: number) => {
      if (duration < 0.005) return;
      const file = path.join(workDir, `silence_${silenceIndex++}.wav`);
      await this.generateSilence(file, duration);
      timeline.push(file);
      cursor += duration;
    };

    for (let i = 0; i < segments.length; i++) {
      const clip = clips[i];
      if (!clip) continue;

      const start = Math.max(segments[i].start, cursor);
      const lateness = start - segments[i].start;
      maxLateness = Math.max(maxLateness, lateness);
      totalLateness += lateness;

      await pushSilence(start - cursor);

      const slot = slotFor(i, start);
      let tempo = 1;
      if (clip.duration > slot.max) {
        tempo = Math.min(MAX_SPEEDUP_TEMPO, clip.duration / slot.max);
      } else if (clip.duration < slot.speech * 0.85) {
        // Much shorter than the original phrase: stretch slightly so the voice
        // covers more of the speaker's lip movement.
        tempo = Math.max(MIN_SLOWDOWN_TEMPO, clip.duration / slot.speech);
      }

      let file = clip.file;
      let duration = clip.duration;
      if (Math.abs(tempo - 1) > 0.02) {
        const stretched = clip.file.replace(/\.wav$/, '_t.wav');
        await this.applyTempo(clip.file, stretched, tempo);
        file = stretched;
        duration = await this.getAudioDuration(stretched);
        stretchedCount++;
        maxTempo = Math.max(maxTempo, tempo);
        minTempo = Math.min(minTempo, tempo);
      }

      timeline.push(file);
      cursor = start + duration;

      this.logger.debug(`Segment ${i + 1}/${segments.length} placed`, {
        start: start.toFixed(2),
        lateness: lateness.toFixed(2),
        speech: slot.speech.toFixed(2),
        slot: slot.max.toFixed(2),
        clip: clip.duration.toFixed(2),
        ttsRate: `${clip.rate}%`,
        tempo: tempo.toFixed(3)
      });
    }

    // 3. Join without crossfades (they shorten the track and shift every later
    //    phrase), then pad/trim to exactly the original duration.
    await this.concatenateExact(timeline, totalDuration, outputPath, workDir);

    const placed = clips.filter(c => c).length;
    this.logger.info('Timestamp-anchored synthesis complete', {
      segments: placed,
      resynthesizedFaster: resynthesized,
      stretched: stretchedCount,
      tempoRange: `${minTempo.toFixed(2)}-${maxTempo.toFixed(2)}`,
      maxLateness: maxLateness.toFixed(2) + 's',
      avgLateness: (totalLateness / Math.max(1, placed)).toFixed(3) + 's',
      overrunAtEnd: Math.max(0, cursor - totalDuration).toFixed(2) + 's'
    });

    fs.rmSync(workDir, { recursive: true, force: true });
  }

  /**
   * Move phrase boundaries onto the real pauses of the source audio.
   *
   * Whisper.cpp returns contiguous segments (each starts where the previous
   * ends), so a phrase "starts" during the speaker's pause and the dub would
   * talk through it. A boundary with a detected pause nearby is split around
   * it: the previous phrase ends when the pause begins, the next one starts
   * when speech resumes. The silence threshold follows the track's loudness
   * so background music doesn't hide every pause.
   */
  private async snapToSourcePauses(segments: TimedText[], audioPath: string): Promise<TimedText[]> {
    const meanVolume = await this.measureMeanVolume(audioPath);
    if (meanVolume === null) return segments;

    const threshold = Math.round(meanVolume - 12);
    const pauses = await this.detectPauses(audioPath, threshold, 0.25);
    const result = segments.map(s => ({ ...s }));
    const window = 1.0; // max distance between a Whisper boundary and a real pause
    const minPhrase = 0.3;
    let snapped = 0;

    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1];
      const next = result[i];
      const boundary = (prev.end + next.start) / 2;
      const pause = pauses.find(([ps, pe]) => pe > boundary - window && ps < boundary + window);
      if (!pause) continue;

      const newEnd = Math.max(prev.start + minPhrase, Math.min(prev.end, pause[0]));
      const newStart = Math.min(next.end - minPhrase, Math.max(next.start, pause[1]));
      if (newStart >= newEnd) {
        prev.end = newEnd;
        next.start = newStart;
        snapped++;
      }
    }

    this.logger.info('Snapped phrase boundaries to source pauses', {
      silenceThreshold: `${threshold}dB`,
      pausesDetected: pauses.length,
      boundariesSnapped: snapped
    });
    return result;
  }

  private async measureMeanVolume(audioPath: string): Promise<number | null> {
    const log = await this.runFfmpegLog(['-i', audioPath, '-af', 'volumedetect', '-f', 'null', '-']);
    const match = log.match(/mean_volume:\s*(-?[\d.]+) dB/);
    return match ? parseFloat(match[1]) : null;
  }

  private async detectPauses(audioPath: string, thresholdDb: number, minDuration: number): Promise<Array<[number, number]>> {
    const log = await this.runFfmpegLog(['-i', audioPath, '-af', `silencedetect=noise=${thresholdDb}dB:d=${minDuration}`, '-f', 'null', '-']);
    const pauses: Array<[number, number]> = [];
    let start: number | null = null;
    for (const line of log.split('\n')) {
      const s = line.match(/silence_start: (-?[\d.]+)/);
      if (s) start = Math.max(0, parseFloat(s[1]));
      const e = line.match(/silence_end: ([\d.]+)/);
      if (e && start !== null) {
        pauses.push([start, parseFloat(e[1])]);
        start = null;
      }
    }
    return pauses;
  }

  /** Run ffmpeg for its analysis output (filters log to stderr). */
  private runFfmpegLog(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('ffmpeg', ['-hide_banner', ...args], { windowsHide: true, maxBuffer: 20 * 1024 * 1024 }, (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`ffmpeg analysis failed: ${(stderr || error.message).toString().slice(-500)}`));
        } else {
          resolve(stderr.toString());
        }
      });
    });
  }

  /**
   * Synthesize one phrase and normalize it to 44.1kHz mono WAV with the
   * leading/trailing silence Edge TTS adds trimmed away (it would otherwise
   * delay every phrase start by ~100-200ms) and short fades against clicks.
   */
  private async synthesizeClip(text: string, voice: string, basePath: string, rate: number): Promise<SynthesizedClip> {
    const mp3 = `${basePath}_r${rate}.mp3`;
    const wav = `${basePath}_r${rate}.wav`;
    await this.generateSpeechEdgeTTSWithRate(text, voice, mp3, `${rate >= 0 ? '+' : ''}${rate}%`);

    const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03';
    const filter = [trim, 'afade=t=in:d=0.01', 'areverse', trim, 'afade=t=in:d=0.01', 'areverse'].join(',');
    await this.runFfmpeg(['-i', mp3, '-af', filter, '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', '-y', wav]);
    fs.unlinkSync(mp3);

    return { file: wav, duration: await this.getAudioDuration(wav), rate };
  }

  private async applyTempo(inputPath: string, outputPath: string, tempo: number): Promise<void> {
    await this.runFfmpeg(['-i', inputPath, '-af', this.getAtempoFilter(tempo), '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', '-y', outputPath]);
  }

  /**
   * Concatenate same-format WAVs sample-exactly (concat demuxer, no
   * re-timing) and pad or trim the result to the target duration.
   */
  private async concatenateExact(files: string[], duration: number, outputPath: string, workDir: string): Promise<void> {
    const listPath = path.join(workDir, 'concat.txt');
    // Absolute paths: the concat demuxer resolves relative entries against the
    // list file's own directory, and the temp dir is usually relative (./temp).
    fs.writeFileSync(listPath, files.map(f => `file '${path.resolve(f).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    await this.runFfmpeg([
      '-f', 'concat', '-safe', '0', '-i', listPath,
      '-af', 'apad', '-t', duration.toFixed(3),
      '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', '-y', outputPath
    ]);
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { windowsHide: true }, (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`ffmpeg failed: ${(stderr || error.message).toString().slice(-500)}`));
        } else {
          resolve();
        }
      });
    });
  }

  /** Run task(0..count-1) with at most `limit` in flight. */
  private async runPool(count: number, limit: number, task: (i: number) => Promise<void>): Promise<void> {
    let next = 0;
    const worker = async () => {
      while (next < count) {
        const i = next++;
        await task(i);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, count) }, worker));
  }

  /**
   * Generate silence audio file with exact duration
   */
  private async generateSilence(outputPath: string, durationSeconds: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-f', 'lavfi',
        '-i', `anullsrc=channel_layout=mono:sample_rate=44100`,
        '-t', durationSeconds.toString(),
        '-acodec', 'pcm_s16le',
        '-y',
        outputPath
      ];

      execFile('ffmpeg', args, (error: Error | null) => {
        if (error) {
          reject(new Error(`Failed to generate silence: ${error.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Segment text intelligently based on punctuation and natural breaks
   */
  private segmentTextIntelligently(text: string): string[] {
    // First split on strong punctuation (., !, ?)
    const sentences = text
      .split(/([.!?]+(?:\s+|$))/)
      .filter(s => s.trim().length > 0)
      .reduce((acc: string[], curr, idx, arr) => {
        // Combine text with following punctuation
        if (idx % 2 === 0) {
          const punct = arr[idx + 1] || '';
          acc.push((curr + punct).trim());
        }
        return acc;
      }, []);

    // Further split long sentences on commas, semicolons
    const segments: string[] = [];
    for (const sentence of sentences) {
      if (sentence.length > 150) {
        // Split long sentences
        const parts = sentence
          .split(/([,;:]+\s+)/)
          .filter(s => s.trim().length > 0)
          .reduce((acc: string[], curr, idx, arr) => {
            if (idx % 2 === 0) {
              const punct = arr[idx + 1] || '';
              acc.push((curr + punct).trim());
            }
            return acc;
          }, []);
        segments.push(...parts);
      } else {
        segments.push(sentence);
      }
    }

    return segments.filter(s => s.length > 0);
  }

  /**
   * Concatenate multiple audio files into one
   */
  /**
   * IMPROVEMENT: Concatenate audio files with cross-fade for seamless transitions
   * Uses acrossfade filter to eliminate clicks/pops between segments
   */
  private async concatenateAudioFiles(audioFiles: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Add all input files
      audioFiles.forEach(file => {
        command.input(file);
      });

      // IMPROVEMENT: Use cross-fade between segments for smooth transitions
      // acrossfade eliminates clicks/pops and creates natural-sounding audio flow
      const crossfadeDuration = 0.010; // 10ms crossfade (subtle but effective)

      if (audioFiles.length === 1) {
        // Single file - no crossfade needed
        const filterComplex = `[0:a]anull[outa]`;
        command.complexFilter(filterComplex);
      } else {
        // Build crossfade chain: [0][1]xfade[a1]; [a1][2]xfade[a2]; ...
        const filters: string[] = [];
        let previousLabel = '0:a';

        for (let i = 1; i < audioFiles.length; i++) {
          const currentLabel = i === audioFiles.length - 1 ? 'outa' : `a${i}`;
          // acrossfade: d=duration, c1/c2=curve (tri=triangular for smooth transition)
          filters.push(`[${previousLabel}][${i}:a]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri[${currentLabel}]`);
          previousLabel = currentLabel;
        }

        command.complexFilter(filters.join(';'));
      }

      command
        .outputOptions(['-map', '[outa]'])
        .toFormat('wav')
        .audioChannels(1)
        .audioFrequency(44100)
        .on('start', (cmd) => {
          this.logger.debug('Concatenating audio with cross-fade', {
            segments: audioFiles.length,
            crossfadeDuration: crossfadeDuration + 's',
            command: cmd.substring(0, 200)
          });
        })
        .on('end', () => {
          this.logger.debug('Audio concatenation with cross-fade complete');
          resolve();
        })
        .on('error', (err: Error) => {
          this.logger.error('Audio concatenation failed', { error: err.message });
          reject(err);
        })
        .save(outputPath);
    });
  }

  /**
   * Generate speech using @andresaya/edge-tts (TypeScript) with rate control
   */
  private async generateSpeechEdgeTTSWithRate(text: string, voice: string, outputPath: string, rate: string = '+0%'): Promise<void> {
    const sanitizedText = text.trim();
    if (!sanitizedText) {
      throw new Error('Empty text provided to Edge TTS');
    }

    this.logger.debug('Generating audio with Edge TTS', {
      voice,
      rate,
      textLength: sanitizedText.length,
      textPreview: sanitizedText.substring(0, 100)
    });

    try {
      const tts = new EdgeTTS();
      await tts.synthesize(sanitizedText, voice, { rate });

      // toFile appends the format extension; strip any existing extension from outputPath
      const outputPathNoExt = outputPath.replace(/\.[^/.]+$/, '');
      const actualPath = await tts.toFile(outputPathNoExt, 'mp3');

      // Rename to the expected outputPath if they differ
      if (actualPath !== outputPath && fs.existsSync(actualPath)) {
        fs.renameSync(actualPath, outputPath);
      }

      if (!fs.existsSync(outputPath)) {
        throw new Error('Edge TTS output file was not created');
      }
      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Edge TTS created an empty file');
      }

      this.logger.debug('Edge TTS synthesis complete', { outputSize: stats.size, rate, textLength: sanitizedText.length });
    } catch (error: any) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('Edge TTS generation failed', { error: errMsg, voice, rate, textPreview: text.substring(0, 100) });
      throw error instanceof Error ? error : new Error(errMsg);
    }
  }

  /**
   * Generate speech using @andresaya/edge-tts (TypeScript)
   */
  private async generateSpeechEdgeTTS(text: string, voice: string, outputPath: string): Promise<void> {
    await this.generateSpeechEdgeTTSWithRate(text, voice, outputPath, '+0%');
  }

  /**
   * Get Microsoft Edge Neural voice for language
   * These are high-quality neural voices available via Edge TTS
   */
  private getEdgeVoiceForLanguage(languageCode: string): string {
    const voiceMap: Record<string, string> = {
      'en': 'en-US-JennyNeural',
      'it': 'it-IT-ElsaNeural',
      'es': 'es-ES-ElviraNeural',
      'fr': 'fr-FR-DeniseNeural',
      'de': 'de-DE-KatjaNeural',
      'pt': 'pt-PT-RaquelNeural',
      'ja': 'ja-JP-NanamiNeural',
      'zh': 'zh-CN-XiaoxiaoNeural',
      'ko': 'ko-KR-SunHiNeural',
      'ru': 'ru-RU-SvetlanaNeural',
      'ar': 'ar-SA-ZariyahNeural',
      'hi': 'hi-IN-SwaraNeural',
      'nl': 'nl-NL-ColetteNeural',
      'pl': 'pl-PL-ZofiaNeural',
      'tr': 'tr-TR-EmelNeural',
      'sv': 'sv-SE-SofieNeural',
      'no': 'nb-NO-PernilleNeural',
      'da': 'da-DK-ChristelNeural',
      'fi': 'fi-FI-NooraNeural',
      'el': 'el-GR-AthinaNeural',
      'cs': 'cs-CZ-VlastaNeural',
      'hu': 'hu-HU-NoemiNeural',
      'ro': 'ro-RO-AlinaNeural',
      'th': 'th-TH-PremwadeeNeural',
      'vi': 'vi-VN-HoaiMyNeural',
      'id': 'id-ID-GadisNeural',
      'he': 'he-IL-HilaNeural',
      'uk': 'uk-UA-PolinaNeural',
      'ca': 'ca-ES-JoanaNeural'
    };

    return voiceMap[languageCode] || 'en-US-JennyNeural'; // Default to English
  }

  private async convertToWav(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('wav')
        .audioChannels(1)
        .audioFrequency(44100) // High quality: 44.1kHz
        .audioBitrate('256k')
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .save(outputPath);
    });
  }

  private async getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });
  }

  private async timeStretchAudio(
    inputPath: string,
    outputPath: string,
    targetDuration: number,
    currentDuration: number
  ): Promise<void> {
    // Calculate tempo adjustment factor
    const tempo = currentDuration / targetDuration;

    // Limit tempo to reasonable range (0.5 to 2.0) to preserve audio quality
    const clampedTempo = Math.max(0.5, Math.min(2.0, tempo));

    // For ultra-precise lip-sync, we need to stretch even tiny differences
    // Removed the 5% threshold - every mismatch must be corrected

    this.logger.debug('Applying time-stretch', {
      targetDuration,
      currentDuration,
      tempo: clampedTempo
    });

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters([
          // Use atempo filter for time-stretching without pitch change
          this.getAtempoFilter(clampedTempo)
        ])
        .on('end', () => {
          this.logger.debug('Time-stretch complete');
          resolve();
        })
        .on('error', (err: Error) => {
          this.logger.error('Time-stretch failed', { error: err.message });
          reject(err);
        })
        .save(outputPath);
    });
  }

  /**
   * Helper method to get padding duration based on speech rate
   */
  private getPaddingForRate(wordsPerSecond: number): string {
    if (wordsPerSecond > 4.5) return '2ms';
    if (wordsPerSecond >= 3.5) return '3ms';
    if (wordsPerSecond < 2.5) return '8ms';
    return '5ms';
  }

  private getAtempoFilter(tempo: number): string {
    // FFmpeg atempo filter only supports 0.5 to 2.0 range
    if (tempo >= 0.5 && tempo <= 2.0) {
      return `atempo=${tempo.toFixed(3)}`;
    } else if (tempo < 0.5) {
      // For very slow speeds, chain multiple atempo filters
      return `atempo=0.5,atempo=${(tempo / 0.5).toFixed(3)}`;
    } else {
      // For very fast speeds, chain multiple atempo filters
      return `atempo=2.0,atempo=${(tempo / 2.0).toFixed(3)}`;
    }
  }
}
