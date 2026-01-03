import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { JobLogger } from '../utils/logger';
import { createJobTempDir, cleanupTempDir, getVideoFileName } from '../utils/paths';
import { validateInputPath, validateOutputDir } from '../utils/path-validator';
import { YoutubeDownloader } from './YoutubeDownloader';
import { AudioExtractor } from './AudioExtractor';
import { WhisperService } from './WhisperService';
import { TranslationService } from './TranslationService';
import { TTSService } from './TTSService';
import { VideoRemux } from './VideoRemux';
import type { ProcessRequest, ProcessResult, ProcessStage, ProgressUpdate } from '../../shared/types';
import type { TempPaths } from '../types';

export class VideoProcessor extends EventEmitter {
  private logger: JobLogger;
  private tempPaths: TempPaths | null = null;
  private cancelled = false;
  private whisperSegments: any[] | undefined = undefined; // Store Whisper segments for advanced lip-sync

  constructor(private request: ProcessRequest) {
    super();
    this.logger = new JobLogger(request.jobId);
  }

  async process(): Promise<ProcessResult> {
    try {
      this.tempPaths = createJobTempDir(this.request.jobId);
      this.logger.info('Starting video processing', { request: this.request });

      // Step 1: Download or validate video
      const videoPath = await this.downloadOrValidateVideo();
      if (this.cancelled) throw new Error('Process cancelled by user');

      // Step 2: Extract audio
      const audioPath = await this.extractAudio(videoPath);
      if (this.cancelled) throw new Error('Process cancelled by user');

      // Step 3: Transcribe with Whisper
      const transcription = await this.transcribe(audioPath);
      if (this.cancelled) throw new Error('Process cancelled by user');

      if (!transcription.success || !transcription.text) {
        throw new Error('Transcription failed: ' + (transcription.error || 'Unknown error'));
      }

      // Step 4: Translate text
      const translatedText = await this.translate(transcription.text, transcription.language);
      if (this.cancelled) throw new Error('Process cancelled by user');

      // Step 5: Text-to-Speech (with duration matching for lip-sync)
      const ttsAudioPath = await this.synthesizeSpeech(translatedText, audioPath);
      if (this.cancelled) throw new Error('Process cancelled by user');

      // Step 6: Remux video
      const outputPath = await this.remuxVideo(videoPath, ttsAudioPath);
      if (this.cancelled) throw new Error('Process cancelled by user');

      // Success
      this.emitProgress('COMPLETED', 100, 'Video processing completed successfully');
      this.logger.info('Video processing completed', { outputPath });

      // Cleanup temp directory
      if (this.tempPaths) {
        cleanupTempDir(this.tempPaths.baseDir);
      }

      return {
        success: true,
        outputPath,
        jobId: this.request.jobId
      };
    } catch (error: any) {
      this.logger.error('Video processing failed', { error: error.message });
      this.emitProgress('ERROR', 0, `Error: ${error.message}`);

      // Cleanup on error
      if (this.tempPaths) {
        cleanupTempDir(this.tempPaths.baseDir);
      }

      return {
        success: false,
        error: error.message,
        jobId: this.request.jobId
      };
    }
  }

  cancel(): void {
    this.cancelled = true;
    this.logger.warn('Process cancellation requested');
    this.emitProgress('ERROR', 0, 'Process cancelled by user');
  }

  private async downloadOrValidateVideo(): Promise<string> {
    this.emitProgress('DOWNLOADING', 5, 'Preparing video...');

    if (this.request.source === 'youtube') {
      if (!this.request.youtubeUrl) {
        throw new Error('YouTube URL is required');
      }

      const downloader = new YoutubeDownloader(this.logger);
      const videoPath = await downloader.download(
        this.request.youtubeUrl,
        this.tempPaths!.baseDir
      );

      this.emitProgress('DOWNLOADING', 15, 'YouTube download complete');
      return videoPath;
    } else {
      // Local file
      if (!this.request.inputPath) {
        throw new Error('Input file path is required');
      }

      // Validate input path for security (prevents path traversal attacks)
      validateInputPath(this.request.inputPath);

      // Resolve and validate local input against a safe uploads root
      const localUploadsRoot = path.resolve(process.cwd(), process.env.LOCAL_UPLOAD_ROOT || 'uploads');
      const inputFileName = path.basename(this.request.inputPath);
      const safeInputPath = path.resolve(localUploadsRoot, inputFileName);

      // Ensure the resolved path is contained within the uploads root
      const realUploadsRoot = fs.realpathSync.native
        ? fs.realpathSync.native(localUploadsRoot)
        : fs.realpathSync(localUploadsRoot);
      const realInputPath = fs.existsSync(safeInputPath)
        ? (fs.realpathSync.native ? fs.realpathSync.native(safeInputPath) : fs.realpathSync(safeInputPath))
        : safeInputPath;
      if (!realInputPath.startsWith(realUploadsRoot + path.sep) && realInputPath !== realUploadsRoot) {
        throw new Error('Invalid input file path');
      }

      // Copy to temp directory
      const videoPath = path.join(this.tempPaths!.baseDir, path.basename(realInputPath));
      fs.copyFileSync(realInputPath, videoPath);

      this.emitProgress('DOWNLOADING', 15, 'Video file validated');
      return videoPath;
    }
  }

  private async extractAudio(videoPath: string): Promise<string> {
    this.emitProgress('EXTRACTING', 20, 'Extracting audio from video...');

    const extractor = new AudioExtractor(this.logger);
    const audioPath = await extractor.extract(videoPath, this.tempPaths!.audioPath);

    this.emitProgress('EXTRACTING', 30, 'Audio extraction complete');
    return audioPath;
  }

  private async transcribe(audioPath: string): Promise<any> {
    this.emitProgress('TRANSCRIBING', 35, 'Transcribing audio with Whisper.cpp...');

    const whisperService = new WhisperService(this.logger);
    const result = await whisperService.transcribe(
      audioPath,
      this.request.sourceLanguage,
      this.request.useCuda
    );

    // Store segments for advanced lip-sync
    if (result.segments && result.segments.length > 0) {
      this.whisperSegments = result.segments;
      this.logger.debug('Stored Whisper segments for advanced lip-sync', { count: this.whisperSegments.length });
    }

    this.emitProgress('TRANSCRIBING', 55, `Transcription complete (${result.language})`);
    return result;
  }

  private async translate(text: string, sourceLanguage: string): Promise<string> {
    this.emitProgress('TRANSLATING', 60, `Translating to ${this.request.targetLanguage}...`);

    const translator = new TranslationService(this.logger);
    const translatedText = await translator.translate(
      text,
      sourceLanguage,
      this.request.targetLanguage
    );

    this.emitProgress('TRANSLATING', 70, 'Translation complete');
    return translatedText;
  }

  private async synthesizeSpeech(text: string, originalAudioPath: string): Promise<string> {
    this.emitProgress('SYNTHESIZING', 75, 'Generating speech from translated text...');

    const tts = new TTSService(this.logger);
    const audioPath = await tts.synthesize(
      text,
      this.request.targetLanguage,
      this.tempPaths!.ttsAudioPath,
      originalAudioPath, // Pass original audio for duration matching
      this.whisperSegments // Pass Whisper segments for timestamp-based lip-sync
    );

    this.emitProgress('SYNTHESIZING', 85, 'Speech synthesis complete');
    return audioPath;
  }

  private async remuxVideo(
    videoPath: string,
    audioPath: string
  ): Promise<string> {
    this.emitProgress('REMUXING', 90, 'Combining video with new audio...');

    // Validate and ensure output directory exists (prevents path traversal attacks)
    validateOutputDir(this.request.outputDir);

    // Generate final output filename
    const outputFileName = getVideoFileName(
      path.basename(videoPath),
      this.request.targetLanguage
    );
    const outputPath = path.join(this.request.outputDir, outputFileName);

    const remuxer = new VideoRemux(this.logger, this.request.useCuda);
    const finalPath = await remuxer.remux(videoPath, audioPath, outputPath);

    this.emitProgress('REMUXING', 98, 'Video remuxing complete');
    return finalPath;
  }

  private emitProgress(stage: ProcessStage, percentage: number, message: string): void {
    const update: ProgressUpdate = {
      jobId: this.request.jobId,
      stage,
      percentage,
      message,
      timestamp: new Date()
    };

    this.emit('progress', update);
  }
}
