// Prepare a benchmark video once: download (or take a local file), extract the
// audio and transcribe it with Whisper. Everything is cached in data/ so the
// translation/TTS stages can be re-run and measured without redoing this.
//
// Usage: npx tsx scripts/lipsync-bench/prep.ts <youtube-url | local-video> [--lang auto]
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { YoutubeDownloader } from '../../src/backend/services/YoutubeDownloader';
import { AudioExtractor } from '../../src/backend/services/AudioExtractor';
import { WhisperService } from '../../src/backend/services/WhisperService';
import { JobLogger } from '../../src/backend/utils/logger';
import { dataDir, argValue } from './common';

dotenv.config({ quiet: true });

async function main() {
  const source = process.argv[2];
  if (!source || source.startsWith('--')) {
    console.error('Usage: npx tsx scripts/lipsync-bench/prep.ts <youtube-url | local-video> [--lang auto]');
    process.exit(1);
  }
  const language = argValue('--lang', 'auto');

  fs.mkdirSync(dataDir, { recursive: true });
  const logger = new JobLogger('lipsync-bench-prep');

  const videoPath = fs.existsSync(source)
    ? path.resolve(source)
    : await new YoutubeDownloader(logger).download(source, dataDir);

  const audioPath = await new AudioExtractor(logger).extract(videoPath, path.join(dataDir, 'audio.wav'));
  const result = await new WhisperService(logger).transcribe(audioPath, language, true);
  if (!result.success || !result.segments || result.segments.length === 0) {
    throw new Error(`Transcription failed: ${result.error || 'no segments'}`);
  }

  fs.writeFileSync(path.join(dataDir, 'transcript.json'), JSON.stringify({
    source,
    videoPath,
    language: result.language,
    text: result.text,
    segments: result.segments
  }, null, 2));

  console.log('Prepared', {
    videoPath,
    language: result.language,
    segments: result.segments.length
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
