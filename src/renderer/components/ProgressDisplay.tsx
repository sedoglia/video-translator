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
    marginBottom: '20px'
  },
  header: {
    margin: '0 0 10px 0',
    fontSize: '16px',
    fontWeight: '600' as const
  },
  stageInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  stageName: {
    fontSize: '14px',
    fontWeight: '500' as const,
    color: '#333'
  },
  percentage: {
    fontSize: '14px',
    fontWeight: '600' as const,
    color: '#007bff'
  },
  progressBarContainer: {
    width: '100%',
    height: '24px',
    backgroundColor: '#e9ecef',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '20px'
  },
  progressBar: {
    height: '100%',
    transition: 'width 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600' as const
  },
  logsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  logsTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: '600' as const
  },
  clearButton: {
    padding: '4px 12px',
    fontSize: '12px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer'
  },
  logsContainer: {
    height: '250px',
    overflowY: 'auto' as const,
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    padding: '12px',
    borderRadius: '4px',
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: '12px',
    lineHeight: '1.5'
  },
  emptyLogs: {
    color: '#666',
    fontStyle: 'italic' as const
  },
  logLine: {
    marginBottom: '2px',
    whiteSpace: 'pre-wrap' as const
  }
};
