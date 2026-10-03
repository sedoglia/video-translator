import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

export const dataDir = path.join(__dirname, 'data');

export interface Transcript {
  source: string;
  videoPath: string;
  language: string;
  text: string;
  segments: Array<{ start: number; end: number; text: string }>;
}

export function loadTranscript(): Transcript {
  const file = path.join(dataDir, 'transcript.json');
  if (!fs.existsSync(file)) {
    console.error('No benchmark data: run scripts/lipsync-bench/prep.ts first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Value following `flag` on the command line, or the default. */
export function argValue(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

export function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

export function ffmpeg(args: string[]): void {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'ignore', 'inherit'] });
}

export function duration(file: string): number {
  return parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }));
}
