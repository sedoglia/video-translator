import youtubedl from 'youtube-dl-exec';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { JobLogger } from '../utils/logger';

const YTDLP_BIN = path.join(
  process.cwd(),
  'node_modules',
  'youtube-dl-exec',
  'bin',
  process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
);

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export class YoutubeDownloader {
  // Auto-update yt-dlp once per backend process. The bundled binary in
  // node_modules can be months out of date, and YouTube's anti-bot rules
  // change frequently — running an outdated binary causes most download
  // failures (Sign-in-to-confirm, fragment 403, partial downloads).
  private static updateAttempted = false;

  constructor(private logger: JobLogger) {}

  async download(url: string, outputDir: string): Promise<string> {
    this.logger.stage('DOWNLOADING', `Starting YouTube download: ${url}`);

    await this.maybeUpdateYtdlp();

    const outputTemplate = path.join(outputDir, 'video.%(ext)s');

    // Strategies in order of preference. Newer yt-dlp versions automatically
    // pick the right player_client, so 'default-web' usually succeeds; the
    // alternatives are fallbacks for stricter videos or older yt-dlp builds.
    const strategies: Array<{ name: string; args: string[] }> = [
      {
        name: 'default-web',
        args: [
          '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
          '--merge-output-format', 'mp4',
          '--no-check-certificates',
          '--prefer-free-formats',
          '--add-header', 'referer:youtube.com'
        ]
      },
      {
        name: 'player-client-tv',
        args: [
          '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
          '--merge-output-format', 'mp4',
          '--no-check-certificates',
          '--extractor-args', 'youtube:player_client=tv'
        ]
      },
      {
        name: 'player-client-ios',
        args: [
          '-f', 'best[ext=mp4]/best',
          '--no-check-certificates',
          '--extractor-args', 'youtube:player_client=ios'
        ]
      },
      {
        name: 'cookies-from-firefox',
        args: [
          '-f', 'best[ext=mp4]/best',
          '--no-check-certificates',
          '--cookies-from-browser', 'firefox'
        ]
      },
      {
        name: 'cookies-from-edge',
        args: [
          '-f', 'best[ext=mp4]/best',
          '--no-check-certificates',
          '--cookies-from-browser', 'edge'
        ]
      }
    ];

    let lastError: Error | null = null;
    for (const strategy of strategies) {
      this.logger.info(`yt-dlp attempt: ${strategy.name}`);
      this.cleanupPartialFiles(outputDir);

      try {
        const args = [
          ...strategy.args,
          '-o', outputTemplate,
          '--no-progress',
          '--verbose',
          url
        ];

        const result = await this.execYtdlp(args);

        this.logger.info(`yt-dlp[${strategy.name}] exitCode`, { exitCode: result.exitCode });
        if (result.stdout) {
          this.logger.info(`yt-dlp[${strategy.name}] stdout`, { output: result.stdout.slice(-3000) });
        }
        if (result.stderr) {
          this.logger.info(`yt-dlp[${strategy.name}] stderr`, { output: result.stderr.slice(-3000) });
        }

        if (result.exitCode !== 0) {
          throw new Error(`yt-dlp exited with code ${result.exitCode}`);
        }

        const videoPath = this.findDownloadedVideo(outputDir);
        this.logger.stage('DOWNLOADING', `YouTube download complete (${strategy.name}): ${videoPath}`);
        return videoPath;
      } catch (error: any) {
        let dirListing = '';
        try {
          dirListing = fs.readdirSync(outputDir).join(', ') || '(empty)';
        } catch {
          dirListing = '(unreadable)';
        }
        this.logger.warn(`yt-dlp attempt failed: ${strategy.name}`, {
          error: error.message,
          dirContents: dirListing
        });
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    // Detect the YouTube auth-required signature and surface a clear message
    const combined = (lastError?.message || '').toLowerCase();
    const authBlock = combined.includes("sign in to confirm") || combined.includes("confirm you") || combined.includes("not a bot");
    if (authBlock) {
      this.logger.error('YouTube is requiring authentication for this video', { url });
      throw new Error('YouTube richiede autenticazione per questo video (verifica anti-bot). Prova un altro video, oppure accedi a YouTube su Firefox/Edge e riprova (i cookie verranno usati automaticamente).');
    }

    this.logger.error('All yt-dlp strategies failed', { lastError: lastError?.message });
    throw new Error(`YouTube download failed: ${lastError?.message || 'unknown error'}`);
  }

  private async maybeUpdateYtdlp(): Promise<void> {
    if (YoutubeDownloader.updateAttempted) return;
    YoutubeDownloader.updateAttempted = true;

    if (!fs.existsSync(YTDLP_BIN)) {
      this.logger.warn('yt-dlp binary not found at expected path', { path: YTDLP_BIN });
      return;
    }

    this.logger.info('Checking for yt-dlp updates (one-time per backend process)');
    try {
      const result = await this.execYtdlp(['-U']);
      const out = (result.stdout + '\n' + result.stderr).trim();
      this.logger.info('yt-dlp self-update result', {
        exitCode: result.exitCode,
        output: out.slice(-1000)
      });
    } catch (err: any) {
      this.logger.warn('yt-dlp self-update failed (continuing with current version)', { error: err.message });
    }
  }

  private execYtdlp(args: string[]): Promise<ExecResult> {
    return new Promise((resolve) => {
      const child = execFile(
        YTDLP_BIN,
        args,
        { maxBuffer: 20 * 1024 * 1024, windowsHide: true },
        (error: any, stdout: string, stderr: string) => {
          resolve({
            stdout: stdout || '',
            stderr: stderr || '',
            exitCode: error ? (typeof error.code === 'number' ? error.code : 1) : 0
          });
        }
      );
      // Mirror progress lines to logs in real time so a stalled download is visible
      if (child.stderr) {
        child.stderr.on('data', (chunk) => {
          const line = chunk.toString().trim();
          if (line) this.logger.debug(`yt-dlp: ${line.slice(0, 500)}`);
        });
      }
    });
  }

  private cleanupPartialFiles(outputDir: string): void {
    try {
      for (const f of fs.readdirSync(outputDir)) {
        if (f.startsWith('video.') && (f.endsWith('.part') || f.endsWith('.ytdl') || f.endsWith('.temp'))) {
          try { fs.unlinkSync(path.join(outputDir, f)); } catch { /* best-effort */ }
        }
      }
    } catch { /* directory may not exist yet */ }
  }

  private findDownloadedVideo(outputDir: string): string {
    const preferredOrder = ['.mp4', '.mkv', '.webm', '.mov', '.m4v', '.flv', '.avi'];

    const candidates = fs.readdirSync(outputDir)
      .filter(f => f.startsWith('video.'))
      .filter(f => {
        const ext = path.extname(f).toLowerCase();
        if (f.endsWith('.part') || f.endsWith('.ytdl') || f.endsWith('.temp')) return false;
        if (ext === '.json' || ext === '.txt') return false;
        return true;
      });

    if (candidates.length === 0) {
      throw new Error(`No downloaded video file found in ${outputDir}`);
    }

    candidates.sort((a, b) => {
      const aRank = preferredOrder.indexOf(path.extname(a).toLowerCase());
      const bRank = preferredOrder.indexOf(path.extname(b).toLowerCase());
      const aScore = aRank === -1 ? preferredOrder.length : aRank;
      const bScore = bRank === -1 ? preferredOrder.length : bRank;
      return aScore - bScore;
    });

    return path.join(outputDir, candidates[0]);
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
