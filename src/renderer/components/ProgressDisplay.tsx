import React, { useRef, useEffect } from 'react';
import type { ProcessStage } from '../../shared/types';

interface ProgressDisplayProps {
  stage: ProcessStage;
  progress: number;
  logs: string[];
  onClearLogs: () => void;
}

const STAGE_NAMES: Record<ProcessStage, string> = {
  IDLE: 'Idle',
  DOWNLOADING: 'Downloading Video',
  EXTRACTING: 'Extracting Audio',
  TRANSCRIBING: 'Transcribing Audio',
  TRANSLATING: 'Translating Text',
  SYNTHESIZING: 'Generating Speech',
  REMUXING: 'Combining Video & Audio',
  COMPLETED: 'Completed',
  ERROR: 'Error'
};

export function ProgressDisplay({ stage, progress, logs, onClearLogs }: ProgressDisplayProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div style={styles.container}>
      <h3 style={styles.header}>Progress</h3>

      <div style={styles.stageInfo}>
        <span style={styles.stageName}>{STAGE_NAMES[stage]}</span>
        <span style={styles.percentage}>{Math.round(progress)}%</span>
      </div>

      <div style={styles.progressBarContainer}>
        <div
          style={{
            ...styles.progressBar,
            width: `${progress}%`,
            backgroundColor: stage === 'ERROR' ? '#dc3545' : '#007bff'
          }}
        />
      </div>

      <div style={styles.logsHeader}>
        <h4 style={styles.logsTitle}>Logs</h4>
        <button onClick={onClearLogs} style={styles.clearButton}>
          Clear
        </button>
      </div>

      <div style={styles.logsContainer}>
        {logs.length === 0 ? (
          <div style={styles.emptyLogs}>No logs yet...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} style={styles.logLine}>
              {log}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

const styles = {
  container: {
    marginBottom: 'clamp(15px, 2vw, 20px)'
  },
  header: {
    margin: '0 0 clamp(8px, 1.5vw, 10px) 0',
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    fontWeight: '600' as const
  },
  stageInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'clamp(6px, 1vw, 8px)',
    flexWrap: 'wrap' as const,
    gap: '8px'
  },
  stageName: {
    fontSize: 'clamp(12px, 2vw, 14px)',
    fontWeight: '500' as const,
    color: '#333'
  },
  percentage: {
    fontSize: 'clamp(12px, 2vw, 14px)',
    fontWeight: '600' as const,
    color: '#007bff'
  },
  progressBarContainer: {
    width: '100%',
    height: 'clamp(20px, 3vw, 24px)',
    backgroundColor: '#e9ecef',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: 'clamp(15px, 2vw, 20px)'
  },
  progressBar: {
    height: '100%',
    transition: 'width 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: 'clamp(10px, 1.5vw, 12px)',
    fontWeight: '600' as const
  },
  logsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'clamp(6px, 1vw, 8px)',
    gap: '8px',
    flexWrap: 'wrap' as const
  },
  logsTitle: {
    margin: 0,
    fontSize: 'clamp(12px, 2vw, 14px)',
    fontWeight: '600' as const
  },
  clearButton: {
    padding: 'clamp(4px, 0.8vw, 6px) clamp(10px, 1.5vw, 12px)',
    fontSize: 'clamp(11px, 1.5vw, 12px)',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer'
  },
  logsContainer: {
    height: 'clamp(180px, 25vh, 250px)',
    overflowY: 'auto' as const,
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    padding: 'clamp(10px, 1.5vw, 12px)',
    borderRadius: '4px',
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: 'clamp(10px, 1.5vw, 12px)',
    lineHeight: '1.5'
  },
  emptyLogs: {
    color: '#666',
    fontStyle: 'italic' as const
  },
  logLine: {
    marginBottom: '2px',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const
  }
};
