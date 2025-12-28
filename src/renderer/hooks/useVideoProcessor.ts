import { useState, useEffect, useCallback } from 'react';
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
      if (currentJobId && update.jobId === currentJobId) {
        setCurrentStage(update.stage);
        setProgress(update.percentage);
        addLog(`[${update.stage}] ${update.message}`);
      }
    });

    newSocket.on('process-complete', (processResult: ProcessResult) => {
      if (currentJobId && processResult.jobId === currentJobId) {
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
  }, [currentJobId]);

  // Fetch GPU info on mount
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/gpu-info`)
      .then(res => res.json())
      .then(info => {
        setGpuInfo(info);
        if (info.cudaAvailable) {
          addLog(`GPU detected: ${info.gpuName} (CUDA available)`);
        } else {
          addLog('No CUDA GPU detected, will use CPU');
        }
      })
      .catch(err => {
        console.error('Failed to get GPU info:', err);
        addLog('Warning: Could not detect GPU status');
      });
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
