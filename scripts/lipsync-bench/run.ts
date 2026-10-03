// Run the app's current translation + lip-sync pipeline on the prepared video
// and save the dubbed track as data/<name>.wav (and data/<name>.mp4 with --mux).
// Translations are cached per target language, so tuning the TTS/alignment
// constants re-runs only the synthesis.
//
// Usage: npx tsx scripts/lipsync-bench/run.ts --name <name> [--target it] [--retranslate] [--mux]
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { TTSService } from '../../src/backend/services/TTSService';
import { TranslationService } from '../../src/backend/services/TranslationService';
import { groupSegmentsBySentence } from '../../src/backend/utils/speech-groups';
import { JobLogger } from '../../src/backend/utils/logger';
import { dataDir, loadTranscript, argValue, hasFlag, ffmpeg } from './common';

dotenv.config({ quiet: true });

async function main() {
  const name = argValue('--name', 'current');
  const target = argValue('--target', 'it');
  const transcript = loadTranscript();
  const logger = new JobLogger(`lipsync-bench-${name}`);
  const started = Date.now();

  const groups = groupSegmentsBySentence(transcript.segments);
  const cache = path.join(dataDir, `translation_${target}.json`);
  let translations: string[];
  if (fs.existsSync(cache) && !hasFlag('--retranslate')) {
    translations = JSON.parse(fs.readFileSync(cache, 'utf8'));
    if (translations.length !== groups.length) {
      throw new Error(`Cached translation has ${translations.length} phrases, grouping produced ${groups.length}: use --retranslate`);
    }
  } else {
    translations = await new TranslationService(logger).translateSegments(groups.map(g => g.text), transcript.language, target);
    fs.writeFileSync(cache, JSON.stringify(translations, null, 1));
  }

  const workDir = path.join(dataDir, `work-${name}`);
  fs.mkdirSync(workDir, { recursive: true });
  const aligned = groups.map((g, i) => ({ start: g.start, end: g.end, text: translations[i] }));
  const ttsPath = path.join(workDir, 'tts.wav');
  await new TTSService(logger).synthesize(translations.join(' '), target, ttsPath, path.join(dataDir, 'audio.wav'), aligned);

  const wavPath = path.join(dataDir, `${name}.wav`);
  fs.copyFileSync(ttsPath, wavPath);
  fs.rmSync(workDir, { recursive: true, force: true });

  if (hasFlag('--mux')) {
    ffmpeg(['-i', transcript.videoPath, '-i', wavPath, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-y', path.join(dataDir, `${name}.mp4`)]);
  }

  console.log('Done', {
    name,
    phrases: groups.length,
    seconds: Math.round((Date.now() - started) / 1000),
    output: wavPath,
    details: `logs/combined.log (job lipsync-bench-${name})`
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
