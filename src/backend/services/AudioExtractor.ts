import ffmpeg from 'fluent-ffmpeg';
import { JobLogger } from '../utils/logger';

export class AudioExtractor {
  constructor(private logger: JobLogger) {}

  async extract(videoPath: string, outputPath: string): Promise<string> {
    this.logger.stage('EXTRACTING', `Extracting audio from video: ${videoPath}`);

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .toFormat('wav')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('start', (commandLine) => {
          this.logger.debug('FFmpeg command:', { commandLine });
        })
        .on('progress', (progress: any) => {
          if (progress.percent) {
            this.logger.debug(`Audio extraction progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          this.logger.stage('EXTRACTING', `Audio extraction complete: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (error) => {
          this.logger.error('Audio extraction failed', { error: error.message });
          reject(new Error(`Audio extraction failed: ${error.message}`));
        })
        .save(outputPath);
    });
  }

  async getDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });
  }
}
