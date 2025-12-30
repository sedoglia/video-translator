import { JobLogger } from '../utils/logger';
import type { TranscriptionResult } from '../../shared/types';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);

/**
 * WhisperService using whisper.cpp binary (precompiled for Windows)
 * No Python required!
 */
export class WhisperService {
  private modelName: string;
  private whisperBinPath: string;
  private modelsPath: string;

  constructor(private logger: JobLogger) {
    // Use tiny model by default (fastest, smallest)
    // Clean the model name (remove any path prefix like "Xenova/")
    const rawModelName = process.env.WHISPER_MODEL_NAME || 'tiny';
    this.modelName = rawModelName.split('/').pop() || 'tiny';

    // Remove "whisper-" prefix if present and extract just the model size
    if (this.modelName.startsWith('whisper-')) {
      this.modelName = this.modelName.replace('whisper-', '');
    }

    // Path to whisper binary
    this.whisperBinPath = path.join(process.cwd(), 'whisper-bin', 'main.exe');

    // Path to models directory
    this.modelsPath = path.join(process.cwd(), 'whisper-bin', 'models');
  }

  /**
   * Transcribe audio file to text
   */
  async transcribe(
    audioPath: string,
    language: string | 'auto',
    useCuda: boolean = false
  ): Promise<TranscriptionResult> {
    this.logger.stage('TRANSCRIBING', `Starting transcription with Whisper.cpp (${this.modelName} model)`);

    try {
      // Check if whisper binary exists
      if (!fs.existsSync(this.whisperBinPath)) {
        throw new Error(`Whisper binary not found at: ${this.whisperBinPath}`);
      }

      // Model file path
      const modelPath = path.join(this.modelsPath, `ggml-${this.modelName}.bin`);

      // Check if model exists
      if (!fs.existsSync(modelPath)) {
        throw new Error(`Whisper model not found at: ${modelPath}. Please download the model first.`);
      }

      this.logger.debug('Starting transcription...', { audioPath, language, model: this.modelName, useCuda });

      // Prepare whisper.cpp arguments
      const args = [
        '-m', modelPath,
        '-f', audioPath,
        '--output-txt',
        '--output-json', // Get JSON output with timestamps
        '--output-file', path.join(path.dirname(audioPath), 'transcript'),
        '--max-len', '1',  // IMPROVEMENT: Force word-level segmentation for finer granularity
        '--split-on-word'  // IMPROVEMENT: Split at word boundaries for better alignment
      ];

      // GPU is enabled by default in whisper.cpp
      // Only add -ng flag if we want to DISABLE GPU
      if (!useCuda) {
        args.push('-ng'); // Disable GPU (use CPU only)
        this.logger.debug('GPU disabled, using CPU only');
      } else {
        this.logger.debug('GPU acceleration enabled for Whisper (CUDA)');
      }

      // Add language if specified
      if (language && language !== 'auto') {
        args.push('-l', language);
      }

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
      if (fs.existsSync(outputJsonPath)) {
        try {
          const jsonContent = fs.readFileSync(outputJsonPath, 'utf-8');
          const jsonData = JSON.parse(jsonContent);

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

      const detectedLanguage = language !== 'auto' ? language : 'en';

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
