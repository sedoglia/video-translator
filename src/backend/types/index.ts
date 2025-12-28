// Backend-specific types

export interface JobQueueItem {
  jobId: string;
  request: import('../../shared/types').ProcessRequest;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface TempPaths {
  baseDir: string;
  videoPath: string;
  audioPath: string;
  ttsAudioPath: string;
  outputPath: string;
}
