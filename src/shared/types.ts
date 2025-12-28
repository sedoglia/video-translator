// Shared types between main, renderer, and backend

export type VideoSource = 'local' | 'youtube';

export type ProcessStage =
  | 'IDLE'
  | 'DOWNLOADING'
  | 'EXTRACTING'
  | 'TRANSCRIBING'
  | 'TRANSLATING'
  | 'SYNTHESIZING'
  | 'REMUXING'
  | 'COMPLETED'
  | 'ERROR';

export interface Language {
  code: string;
  name: string;
  ttsVoice?: string;
}

export interface ProcessRequest {
  jobId: string;
  source: VideoSource;
  inputPath?: string;
  youtubeUrl?: string;
  sourceLanguage: string | 'auto';
  targetLanguage: string;
  useCuda: boolean;
  outputDir: string;
}

export interface ProcessResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  jobId: string;
}

export interface ProgressUpdate {
  jobId: string;
  stage: ProcessStage;
  percentage: number;
  message: string;
  timestamp: Date;
}

export interface LogMessage {
  jobId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Date;
  stage?: ProcessStage;
}

export interface TranscriptionSegment {
  start: number;  // Start time in seconds
  end: number;    // End time in seconds
  text: string;   // Segment text
}

export interface TranscriptionResult {
  text: string;
  language: string;
  duration?: number;
  segments?: TranscriptionSegment[];  // Segments with timestamps
  success: boolean;
  error?: string;
}

export interface GPUInfo {
  cudaAvailable: boolean;
  gpuName?: string;
  driverVersion?: string;
}

// IPC Channels
export const IPC_CHANNELS = {
  PROCESS_VIDEO: 'process-video',
  CANCEL_PROCESS: 'cancel-process',
  SELECT_FILE: 'select-file',
  SELECT_FOLDER: 'select-folder',
  OPEN_FOLDER: 'open-folder',
  GET_GPU_INFO: 'get-gpu-info',
  PROGRESS_UPDATE: 'progress-update',
  LOG_MESSAGE: 'log-message',
  PROCESS_COMPLETE: 'process-complete'
} as const;

// Supported Languages
export const LANGUAGES: Language[] = [
  { code: 'auto', name: 'Auto Detect' },
  { code: 'en', name: 'English', ttsVoice: 'en-US-JennyNeural' },
  { code: 'it', name: 'Italian', ttsVoice: 'it-IT-ElsaNeural' },
  { code: 'es', name: 'Spanish', ttsVoice: 'es-ES-ElviraNeural' },
  { code: 'fr', name: 'French', ttsVoice: 'fr-FR-DeniseNeural' },
  { code: 'de', name: 'German', ttsVoice: 'de-DE-KatjaNeural' },
  { code: 'pt', name: 'Portuguese', ttsVoice: 'pt-PT-RaquelNeural' },
  { code: 'ja', name: 'Japanese', ttsVoice: 'ja-JP-NanamiNeural' },
  { code: 'zh', name: 'Chinese (Simplified)', ttsVoice: 'zh-CN-XiaoxiaoNeural' },
  { code: 'ko', name: 'Korean', ttsVoice: 'ko-KR-SunHiNeural' },
  { code: 'ru', name: 'Russian', ttsVoice: 'ru-RU-SvetlanaNeural' },
  { code: 'ar', name: 'Arabic', ttsVoice: 'ar-SA-ZariyahNeural' },
  { code: 'hi', name: 'Hindi', ttsVoice: 'hi-IN-SwaraNeural' },
  { code: 'nl', name: 'Dutch', ttsVoice: 'nl-NL-ColetteNeural' },
  { code: 'pl', name: 'Polish', ttsVoice: 'pl-PL-ZofiaNeural' },
  { code: 'tr', name: 'Turkish', ttsVoice: 'tr-TR-EmelNeural' },
  { code: 'sv', name: 'Swedish', ttsVoice: 'sv-SE-SofieNeural' },
  { code: 'no', name: 'Norwegian', ttsVoice: 'nb-NO-PernilleNeural' },
  { code: 'da', name: 'Danish', ttsVoice: 'da-DK-ChristelNeural' },
  { code: 'fi', name: 'Finnish', ttsVoice: 'fi-FI-NooraNeural' },
  { code: 'el', name: 'Greek', ttsVoice: 'el-GR-AthinaNeural' },
  { code: 'cs', name: 'Czech', ttsVoice: 'cs-CZ-VlastaNeural' },
  { code: 'hu', name: 'Hungarian', ttsVoice: 'hu-HU-NoemiNeural' },
  { code: 'ro', name: 'Romanian', ttsVoice: 'ro-RO-AlinaNeural' },
  { code: 'th', name: 'Thai', ttsVoice: 'th-TH-PremwadeeNeural' },
  { code: 'vi', name: 'Vietnamese', ttsVoice: 'vi-VN-HoaiMyNeural' },
  { code: 'id', name: 'Indonesian', ttsVoice: 'id-ID-GadisNeural' },
  { code: 'he', name: 'Hebrew', ttsVoice: 'he-IL-HilaNeural' },
  { code: 'uk', name: 'Ukrainian', ttsVoice: 'uk-UA-PolinaNeural' },
  { code: 'ca', name: 'Catalan', ttsVoice: 'ca-ES-JoanaNeural' }
];

// Video file extensions
export const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv'];
