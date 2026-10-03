import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ProcessStage, ProgressUpdate, ProcessResult, GPUInfo } from '../../shared/types';

const BACKEND_URL = 'http://localhost:3001';

export function useVideoProcessor() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [processing, setProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState<ProcessStage>('IDLE');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [gpuInfo, setGpuInfo] = useState<GPUInfo | null>(null);
  // Read by the socket handlers: one connection for the app's lifetime instead
  // of reconnecting (and missing events) every time a job starts.
  const currentJobIdRef = useRef<string | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(BACKEND_URL);

    newSocket.on('connect', () => {
      addLog('Connected to backend server');
    });

    newSocket.on('disconnect', () => {
      addLog('Disconnected from backend server');
    });

    newSocket.on('progress', (update: ProgressUpdate) => {
      if (currentJobIdRef.current && update.jobId === currentJobIdRef.current) {
        setCurrentStage(update.stage);
        setProgress(update.percentage);
        addLog(`[${update.stage}] ${update.message}`);
      }
    });

    newSocket.on('process-complete', (processResult: ProcessResult) => {
      if (currentJobIdRef.current && processResult.jobId === currentJobIdRef.current) {
        setProcessing(false);
        setResult(processResult);

        if (processResult.success) {
          addLog(`✓ Processing complete! Output: ${processResult.outputPath}`);
        } else {
          addLog(`✗ Processing failed: ${processResult.error}`);
        }
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Fetch GPU info on mount. The ignore flag drops the result of a discarded
  // mount (React StrictMode mounts twice in development), so it's logged once.
  useEffect(() => {
    let ignore = false;
    fetch(`${BACKEND_URL}/api/gpu-info`)
      .then(res => res.json())
      .then(info => {
        if (ignore) return;
        setGpuInfo(info);
        if (info.cudaAvailable) {
          addLog(`GPU detected: ${info.gpuName} (CUDA available)`);
        } else {
          addLog('No CUDA GPU detected, will use CPU');
        }
      })
      .catch(err => {
        if (ignore) return;
        console.error('Failed to get GPU info:', err);
        addLog('Warning: Could not detect GPU status');
      });
    return () => {
      ignore = true;
    };
  }, []);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => {
      const newLogs = [...prev, `[${timestamp}] ${message}`];
      // Keep only last 1000 lines
      return newLogs.slice(-1000);
    });
  }, []);

  const startProcessing = async (params: {
    source: 'local' | 'youtube';
    inputPath?: string;
    youtubeUrl?: string;
    sourceLanguage: string;
    targetLanguage: string;
    useCuda: boolean;
    outputDir: string;
  }) => {
    try {
      setProcessing(true);
      setCurrentStage('IDLE');
      setProgress(0);
      setResult(null);
      setLogs([]);
      addLog('Starting video processing...');

      const response = await fetch(`${BACKEND_URL}/api/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start processing');
      }

      currentJobIdRef.current = data.jobId;
      setCurrentJobId(data.jobId);
      addLog(`Job created: ${data.jobId}`);
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
      setProcessing(false);
    }
  };

  const cancelProcessing = async () => {
    if (!currentJobId) return;

    try {
      await fetch(`${BACKEND_URL}/api/cancel/${currentJobId}`, {
        method: 'POST'
      });

      addLog('Cancellation requested...');
      setProcessing(false);
      setCurrentStage('IDLE');
    } catch (error: any) {
      addLog(`Failed to cancel: ${error.message}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return {
    processing,
    currentStage,
    progress,
    logs,
    result,
    gpuInfo,
    startProcessing,
    cancelProcessing,
    clearLogs
  };
}
