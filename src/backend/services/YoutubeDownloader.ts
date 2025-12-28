import youtubedl from 'youtube-dl-exec';
import path from 'path';
import { JobLogger } from '../utils/logger';

export class YoutubeDownloader {
  constructor(private logger: JobLogger) {}

  async download(url: string, outputDir: string): Promise<string> {
    this.logger.stage('DOWNLOADING', `Starting YouTube download: ${url}`);

    const outputTemplate = path.join(outputDir, 'video.%(ext)s');

    try {
      const result = await youtubedl(url, {
        output: outputTemplate,
        format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        mergeOutputFormat: 'mp4',
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: ['referer:youtube.com', 'user-agent:googlebot']
      });

      const videoPath = path.join(outputDir, 'video.mp4');
      this.logger.stage('DOWNLOADING', `YouTube download complete: ${videoPath}`);

      return videoPath;
    } catch (error: any) {
      this.logger.error('YouTube download failed', { error: error.message });
      throw new Error(`YouTube download failed: ${error.message}`);
    }
  }

  async getVideoInfo(url: string): Promise<any> {
    try {
      const info = await youtubedl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true
      });
      return info;
    } catch (error: any) {
      throw new Error(`Failed to get video info: ${error.message}`);
    }
  }
}
