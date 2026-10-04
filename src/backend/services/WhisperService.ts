import { JobLogger } from '../utils/logger';
import type { TranscriptionResult } from '../../shared/types';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { getResourcesDir, getDataDir, isPackaged } from '../utils/runtime';

const execFileAsync = promisify(execFile);

const MODEL_BASE_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

/** Called while a missing model is downloaded (bytes so far, total bytes or 0 if unknown). */
export type ModelDownloadProgress = (downloaded: number, total: number) => void;

/**
 * WhisperService using whisper.cpp binary (precompiled for Windows)
 * No Python required!
 */
export class WhisperService {
  private modelName: string;
  private whisperBinPath: string;
  private modelsPath: string;

  constructor(private logger: JobLogger) {
    // medium by default: best balance of quality and timestamp precision (the
    // lip-sync depends on it). Clean the model name (remove any path prefix like "Xenova/")
    const rawModelName = process.env.WHISPER_MODEL_NAME || 'medium';
    this.modelName = rawModelName.split('/').pop() || 'medium';

    // Remove "whisper-" prefix if present and extract just the model size
    if (this.modelName.startsWith('whisper-')) {
      this.modelName = this.modelName.replace('whisper-', '');
    }

    // Binaries ship with the app; models are downloaded to a writable folder
    // in the installed app (the resources folder is read-only there).
    // whisper.cpp >= 1.7 ships whisper-cli.exe and turns main.exe into a stub
    // that only prints a deprecation warning; main.exe is the pre-1.7 binary.
    const binDir = path.join(getResourcesDir(), 'whisper-bin');
    const cli = path.join(binDir, 'whisper-cli.exe');
    this.whisperBinPath = fs.existsSync(cli) ? cli : path.join(binDir, 'main.exe');
    this.modelsPath = isPackaged()
      ? path.join(getDataDir(), 'models')
      : path.join(getResourcesDir(), 'whisper-bin', 'models');
  }

  /**
   * Download the model if it isn't there yet (first run of the installed app).
   * Written to a .part file and renamed at the end, so an interrupted
   * download is never mistaken for a complete model.
   */
  private async ensureModel(modelPath: string, onProgress?: ModelDownloadProgress): Promise<void> {
    if (fs.existsSync(modelPath)) return;

    const url = `${MODEL_BASE_URL}/${path.basename(modelPath)}`;
    const partPath = `${modelPath}.part`;
    fs.mkdirSync(path.dirname(modelPath), { recursive: true });
    this.logger.stage('TRANSCRIBING', `Downloading Whisper model ${this.modelName} from ${url}`);

    const response = await axios.get(url, { responseType: 'stream', timeout: 30000, maxRedirects: 5 });
    const total = Number(response.headers['content-length']) || 0;
    let downloaded = 0;

    await new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(partPath);
      response.data.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        onProgress?.(downloaded, total);
      });
      response.data.on('error', reject);
      file.on('error', reject);
      file.on('finish', resolve);
      response.data.pipe(file);
    }).catch((error) => {
      fs.rmSync(partPath, { force: true });
      throw new Error(`Whisper model download failed: ${error.message}`);
    });

    if (total > 0 && downloaded !== total) {
      fs.rmSync(partPath, { force: true });
      throw new Error(`Whisper model download incomplete (${downloaded} of ${total} bytes)`);
    }
    fs.renameSync(partPath, modelPath);
    this.logger.stage('TRANSCRIBING', `Whisper model downloaded (${(downloaded / 1048576).toFixed(0)} MB)`);
  }

  /**
   * Transcribe audio file to text
   */
  async transcribe(
    audioPath: string,
    language: string | 'auto',
    useCuda: boolean = false,
    onModelDownload?: ModelDownloadProgress
  ): Promise<TranscriptionResult> {
    this.logger.stage('TRANSCRIBING', `Starting transcription with Whisper.cpp (${this.modelName} model)`);

    try {
      // Check if whisper binary exists
      if (!fs.existsSync(this.whisperBinPath)) {
        throw new Error(`Whisper binary not found at: ${this.whisperBinPath}`);
      }

      // Model file path
      const modelPath = path.join(this.modelsPath, `ggml-${this.modelName}.bin`);

      await this.ensureModel(modelPath, onModelDownload);

      this.logger.debug('Starting transcription...', { audioPath, language, model: this.modelName, useCuda });

      // Prepare whisper.cpp arguments
      const args = [
        '-m', modelPath,
        '-f', audioPath,
        '--output-txt',
        '--output-json', // Get JSON output with timestamps
        '--output-file', path.join(path.dirname(audioPath), 'transcript'),
        '--split-on-word'  // Split at word boundaries for natural phrase breaks
        // NOTE: Removed --max-len 1 to keep phrase-level segmentation
        // This ensures full sentences are translated together for proper context
      ];

      // GPU is enabled by default in whisper.cpp
      // Only add -ng flag if we want to DISABLE GPU
      if (!useCuda) {
        args.push('-ng'); // Disable GPU (use CPU only)
        this.logger.debug('GPU disabled, using CPU only');
      } else {
        this.logger.debug('GPU acceleration enabled for Whisper (CUDA)');
      }

      // whisper-cli assumes English when -l is omitted: auto-detection must be
      // requested explicitly
      args.push('-l', language && language !== 'auto' ? language : 'auto');

      // Execute whisper.cpp
      const { stdout, stderr } = await execFileAsync(this.whisperBinPath, args, {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      this.logger.debug('Whisper.cpp output:', { stdout: stdout.substring(0, 500) });

      // Read the output txt file
      const outputTxtPath = path.join(path.dirname(audioPath), 'transcript.txt');
      const outputJsonPath = path.join(path.dirname(audioPath), 'transcript.json');

      if (!fs.existsSync(outputTxtPath)) {
        throw new Error('Transcription output file not found');
      }

      const text = fs.readFileSync(outputTxtPath, 'utf-8').trim();

      // Parse JSON output for timestamps
      let segments: any[] = [];
      let reportedLanguage: string | undefined;
      if (fs.existsSync(outputJsonPath)) {
        try {
          const jsonContent = fs.readFileSync(outputJsonPath, 'utf-8');
          const jsonData = JSON.parse(jsonContent);
          reportedLanguage = jsonData.result?.language;

          this.logger.debug('Whisper JSON structure', {
            keys: Object.keys(jsonData),
            hasTranscription: !!jsonData.transcription,
            transcriptionType: jsonData.transcription ? typeof jsonData.transcription : 'undefined',
            sampleData: JSON.stringify(jsonData).substring(0, 500)
          });

          // Extract segments with timestamps from Whisper JSON format
          if (jsonData.transcription && Array.isArray(jsonData.transcription)) {
            segments = jsonData.transcription
              .map((seg: any, index: number) => {
                // Log raw segment data for first few segments to debug
                if (index < 3) {
                  this.logger.debug(`Raw Whisper segment ${index}`, {
                    hasTimestamps: !!seg.timestamps,
                    hasOffsets: !!seg.offsets,
                    timestampsFrom: seg.timestamps?.from,
                    timestampsTo: seg.timestamps?.to,
                    offsetsFrom: seg.offsets?.from,
                    offsetsTo: seg.offsets?.to,
                    text: seg.text?.substring(0, 30)
                  });
                }

                // Parse timestamps - can be either numbers (milliseconds) or SRT format strings ("HH:MM:SS,mmm")
                let start = 0;
                let end = 0;

                const rawStart = seg.timestamps?.from || seg.offsets?.from;
                const rawEnd = seg.timestamps?.to || seg.offsets?.to;

                if (typeof rawStart === 'string') {
                  // SRT format: "00:00:00,000" -> convert to seconds
                  start = this.parseSRTTimestamp(rawStart);
                } else if (typeof rawStart === 'number') {
                  // Numeric milliseconds -> convert to seconds
                  start = rawStart / 1000;
                }

                if (typeof rawEnd === 'string') {
                  // SRT format: "00:00:00,000" -> convert to seconds
                  end = this.parseSRTTimestamp(rawEnd);
                } else if (typeof rawEnd === 'number') {
                  // Numeric milliseconds -> convert to seconds
                  end = rawEnd / 1000;
                }

                const text = seg.text?.trim() || '';

                // Check for NaN
                if (isNaN(start) || isNaN(end)) {
                  this.logger.warn(`NaN timestamp in segment ${index}`, {
                    start,
                    end,
                    rawStart: seg.timestamps?.from || seg.offsets?.from,
                    rawEnd: seg.timestamps?.to || seg.offsets?.to,
                    text: text.substring(0, 50)
                  });
                }

                // Validate timestamp integrity
                if (start >= end) {
                  this.logger.warn(`Invalid timestamp in segment ${index}: start >= end`, { start, end });
                  // Fix: ensure minimum 100ms duration
                  return { start, end: start + 0.1, text };
                }

                return { start, end, text };
              })
              .filter((seg: any) => seg.text); // Only filter segments with text

            // Verify temporal continuity
            for (let i = 1; i < segments.length; i++) {
              const gap = segments[i].start - segments[i - 1].end;
              if (gap < 0) {
                this.logger.warn(`Overlapping segments detected: ${i - 1} and ${i}`, {
                  gap: gap.toFixed(3) + 's',
                  prevEnd: segments[i - 1].end.toFixed(3),
                  currStart: segments[i].start.toFixed(3)
                });
              }
            }

            this.logger.debug('Timestamp extraction complete', {
              totalSegments: segments.length,
              firstSegment: segments[0],
              lastSegment: segments[segments.length - 1],
              totalDuration: (segments[segments.length - 1]?.end - segments[0]?.start).toFixed(2) + 's'
            });
          } else {
            this.logger.warn('JSON format not recognized - transcription field missing or not an array');
          }

          this.logger.debug(`Parsed ${segments.length} segments with timestamps`);
        } catch (e: any) {
          this.logger.warn('Failed to parse JSON timestamps, will use simple time-stretching', { error: e.message });
        }
      } else {
        this.logger.warn('JSON output file not found, segments will not have timestamps');
      }

      // Clean up temporary output files
      try {
        fs.unlinkSync(outputTxtPath);
        if (fs.existsSync(outputJsonPath)) {
          fs.unlinkSync(outputJsonPath);
        }
      } catch (e) {
        // Ignore cleanup errors
      }

      // With auto-detect, use the language Whisper found (JSON result, or the
      // "auto-detected language: xx" line on stderr): it drives translation
      // and the TTS voice.
      let detectedLanguage = language;
      if (!language || language === 'auto') {
        const fromStderr = stderr.match(/auto-detected language:\s*([a-z]{2,3})/)?.[1];
        detectedLanguage = reportedLanguage || fromStderr || 'en';
        if (!reportedLanguage && !fromStderr) {
          this.logger.warn('Whisper did not report the detected language, assuming English');
        }
      }

      this.logger.stage(
        'TRANSCRIBING',
        `Transcription complete. Language: ${detectedLanguage}, Length: ${text.length} chars, Segments: ${segments.length}`
      );

      return {
        text,
        language: detectedLanguage,
        segments: segments.length > 0 ? segments : undefined,
        success: true
      };
    } catch (error: any) {
      this.logger.error('Whisper transcription failed', { error: error.message });
      return {
        text: '',
        language: '',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse SRT timestamp format to seconds
   * Format: "HH:MM:SS,mmm" or "HH:MM:SS.mmm"
   */
  private parseSRTTimestamp(timestamp: string): number {
    try {
      // Handle both comma and dot as decimal separator
      const normalized = timestamp.replace(',', '.');

      // Parse HH:MM:SS.mmm
      const parts = normalized.split(':');
      if (parts.length !== 3) {
        this.logger.warn('Invalid SRT timestamp format', { timestamp });
        return 0;
      }

      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const secondsParts = parts[2].split('.');
      const seconds = parseInt(secondsParts[0], 10);
      const milliseconds = secondsParts[1] ? parseInt(secondsParts[1].padEnd(3, '0').substring(0, 3), 10) : 0;

      const totalSeconds = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;

      return totalSeconds;
    } catch (error) {
      this.logger.warn('Failed to parse SRT timestamp', { timestamp, error });
      return 0;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // No cleanup needed
  }
}
