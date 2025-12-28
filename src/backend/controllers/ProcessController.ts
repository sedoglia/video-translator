import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { VideoProcessor } from '../services/VideoProcessor';
import { detectCudaAvailability, shouldUseCuda } from '../utils/gpu-detector';
import { getOutputDir } from '../utils/paths';
import { logger } from '../utils/logger';
import type { ProcessRequest, GPUInfo } from '../../shared/types';
import type { Server as SocketIOServer } from 'socket.io';

export class ProcessController {
  private activeProcessors = new Map<string, VideoProcessor>();
  private gpuInfo: GPUInfo | null = null;

  constructor(private io: SocketIOServer) {}

  async getGPUInfo(req: Request, res: Response): Promise<void> {
    try {
      if (!this.gpuInfo) {
        this.gpuInfo = await detectCudaAvailability();
      }
      res.json(this.gpuInfo);
    } catch (error: any) {
      logger.error('Failed to get GPU info', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  async processVideo(req: Request, res: Response): Promise<void> {
    try {
      const jobId = uuidv4();
      const requestData = req.body;

      // Validate request
      if (!requestData.source) {
        res.status(400).json({ error: 'Source type is required' });
        return;
      }

      if (requestData.source === 'youtube' && !requestData.youtubeUrl) {
        res.status(400).json({ error: 'YouTube URL is required' });
        return;
      }

      if (requestData.source === 'local' && !requestData.inputPath) {
        res.status(400).json({ error: 'Input file path is required' });
        return;
      }

      // Determine CUDA usage
      if (!this.gpuInfo) {
        this.gpuInfo = await detectCudaAvailability();
      }

      const useCuda = shouldUseCuda(requestData.useCuda, this.gpuInfo);

      // Create process request
      const processRequest: ProcessRequest = {
        jobId,
        source: requestData.source,
        inputPath: requestData.inputPath,
        youtubeUrl: requestData.youtubeUrl,
        sourceLanguage: requestData.sourceLanguage || 'auto',
        targetLanguage: requestData.targetLanguage,
        useCuda,
        outputDir: requestData.outputDir || getOutputDir()
      };

      // Create processor
      const processor = new VideoProcessor(processRequest);
      this.activeProcessors.set(jobId, processor);

      // Listen to progress events
      processor.on('progress', (update) => {
        this.io.emit('progress', update);
      });

      // Start processing (async)
      processor.process().then((result) => {
        this.io.emit('process-complete', result);
        this.activeProcessors.delete(jobId);
      }).catch((error) => {
        logger.error('Process failed', { jobId, error: error.message });
        this.activeProcessors.delete(jobId);
      });

      // Return job ID immediately
      res.json({ jobId, status: 'processing' });
    } catch (error: any) {
      logger.error('Failed to start process', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  cancelProcess(req: Request, res: Response): void {
    const { jobId } = req.params;

    const processor = this.activeProcessors.get(jobId);
    if (!processor) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    processor.cancel();
    this.activeProcessors.delete(jobId);

    res.json({ success: true, message: 'Process cancelled' });
  }

  getStatus(req: Request, res: Response): void {
    const { jobId } = req.params;

    const processor = this.activeProcessors.get(jobId);
    if (!processor) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json({ jobId, status: 'processing' });
  }
}
