import React from 'react';
import type { ProcessResult } from '../../shared/types';

interface ResultPanelProps {
  result: ProcessResult | null;
}

export function ResultPanel({ result }: ResultPanelProps) {
  if (!result) return null;

  const handleOpenFolder = async () => {
    if (result.outputPath && window.electronAPI) {
      await window.electronAPI.openFolder(result.outputPath);
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.header}>Result</h3>

      {result.success ? (
        <div style={styles.successContainer}>
          <div style={styles.successIcon}>✓</div>
          <div style={styles.successContent}>
            <p style={styles.successTitle}>Processing Complete!</p>
            <p style={styles.outputPath}>{result.outputPath}</p>
            <button onClick={handleOpenFolder} style={styles.openButton}>
              Open Output Folder
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.errorContainer}>
          <div style={styles.errorIcon}>✗</div>
          <div style={styles.errorContent}>
            <p style={styles.errorTitle}>Processing Failed</p>
            <p style={styles.errorMessage}>{result.error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    marginTop: 'clamp(15px, 2vw, 20px)'
  },
  header: {
    margin: '0 0 clamp(8px, 1.5vw, 10px) 0',
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    fontWeight: '600' as const
  },
  successContainer: {
    display: 'flex',
    gap: 'clamp(10px, 2vw, 15px)',
    padding: 'clamp(15px, 2.5vw, 20px)',
    backgroundColor: '#d4edda',
    border: '1px solid #c3e6cb',
    borderRadius: '4px',
    flexWrap: 'wrap' as const
  },
  successIcon: {
    fontSize: 'clamp(28px, 4vw, 32px)',
    color: '#28a745',
    fontWeight: 'bold' as const,
    flexShrink: 0
  },
  successContent: {
    flex: '1 1 200px',
    minWidth: '150px'
  },
  successTitle: {
    margin: '0 0 clamp(8px, 1.5vw, 10px) 0',
    fontSize: 'clamp(16px, 2.5vw, 18px)',
    fontWeight: '600' as const,
    color: '#155724'
  },
  outputPath: {
    margin: '0 0 clamp(12px, 2vw, 15px) 0',
    fontSize: 'clamp(11px, 1.8vw, 13px)',
    color: '#155724',
    wordBreak: 'break-all' as const,
    fontFamily: 'Consolas, Monaco, monospace'
  },
  openButton: {
    padding: 'clamp(8px, 1.2vw, 10px) clamp(14px, 2vw, 16px)',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: 'clamp(12px, 2vw, 14px)',
    fontWeight: '500' as const
  },
  errorContainer: {
    display: 'flex',
    gap: 'clamp(10px, 2vw, 15px)',
    padding: 'clamp(15px, 2.5vw, 20px)',
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    borderRadius: '4px',
    flexWrap: 'wrap' as const
  },
  errorIcon: {
    fontSize: 'clamp(28px, 4vw, 32px)',
    color: '#dc3545',
    fontWeight: 'bold' as const,
    flexShrink: 0
  },
  errorContent: {
    flex: '1 1 200px',
    minWidth: '150px'
  },
  errorTitle: {
    margin: '0 0 clamp(8px, 1.5vw, 10px) 0',
    fontSize: 'clamp(16px, 2.5vw, 18px)',
    fontWeight: '600' as const,
    color: '#721c24'
  },
  errorMessage: {
    margin: 0,
    fontSize: 'clamp(12px, 2vw, 14px)',
    color: '#721c24',
    wordBreak: 'break-word' as const
  }
};
