import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { TempPaths } from '../types';

export function getTempDir(): string {
  const tempBase = process.env.TEMP_DIR || path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempBase)) {
    fs.mkdirSync(tempBase, { recursive: true });
  }
  return tempBase;
}

export function getOutputDir(): string {
  // Use C:\TEMP as default output directory
  const defaultOutputPath = 'C:\\TEMP';
  const outputBase = process.env.OUTPUT_DIR || defaultOutputPath;
  if (!fs.existsSync(outputBase)) {
    fs.mkdirSync(outputBase, { recursive: true });
  }
  return outputBase;
}

export function createJobTempDir(jobId: string): TempPaths {
  const baseDir = path.join(getTempDir(), jobId);
  fs.mkdirSync(baseDir, { recursive: true });

  return {
    baseDir,
    videoPath: path.join(baseDir, 'video'),
    audioPath: path.join(baseDir, 'audio.wav'),
    ttsAudioPath: path.join(baseDir, 'tts_audio.wav'),
    outputPath: path.join(getOutputDir(), `output_${jobId}.mp4`)
  };
}

export function cleanupTempDir(tempDir: string): void {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(`Failed to cleanup temp dir ${tempDir}:`, error);
  }
}

export function getVideoFileName(originalPath: string, targetLanguage: string): string {
  const ext = path.extname(originalPath);
  const basename = path.basename(originalPath, ext);
  return `${basename}_translated_to_${targetLanguage}${ext}`;
}

export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
