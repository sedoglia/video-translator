import ffmpeg from 'fluent-ffmpeg';
import { JobLogger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export class VideoRemux {
  constructor(private logger: JobLogger, private useCuda: boolean = false) {}

  async remux(
    originalVideoPath: string,
    newAudioPath: string,
    outputPath: string
  ): Promise<string> {
    this.logger.stage('REMUXING', 'Remuxing video with new audio track');

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      this.logger.debug('Creating output directory', { outputDir });
      fs.mkdirSync(outputDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Input video (without audio)
      command.input(originalVideoPath);

      // Input new audio
      command.input(newAudioPath);

      // Just copy video stream and encode audio
      const outputOptions = [
        '-map', '0:v:0',   // Video from first input
        '-map', '1:a:0',   // Audio from second input
        '-c:v', 'copy',    // Copy video codec (no re-encoding)
        '-c:a', 'aac',     // Encode audio to AAC
        '-b:a', '128k',    // Audio bitrate
        '-shortest'        // End when shortest stream ends
      ];

      command.outputOptions(outputOptions);

      command
        .on('start', (commandLine) => {
          this.logger.debug('FFmpeg remux command:', { commandLine });
        })
        .on('progress', (progress: any) => {
          if (progress.percent) {
            this.logger.debug(`Remux progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          this.logger.stage('REMUXING', `Video remux complete: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (error) => {
          this.logger.error('Video remux failed', { error: error.message });
          reject(new Error(`Video remux failed: ${error.message}`));
        })
        .save(outputPath);
    });
  }
}
