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
    marginTop: '20px'
  },
  header: {
    margin: '0 0 10px 0',
    fontSize: '16px',
    fontWeight: '600' as const
  },
  successContainer: {
    display: 'flex',
    gap: '15px',
    padding: '20px',
    backgroundColor: '#d4edda',
    border: '1px solid #c3e6cb',
    borderRadius: '4px'
  },
  successIcon: {
    fontSize: '32px',
    color: '#28a745',
    fontWeight: 'bold' as const
  },
  successContent: {
    flex: 1
  },
  successTitle: {
    margin: '0 0 10px 0',
    fontSize: '18px',
    fontWeight: '600' as const,
    color: '#155724'
  },
  outputPath: {
    margin: '0 0 15px 0',
    fontSize: '13px',
    color: '#155724',
    wordBreak: 'break-all' as const,
    fontFamily: 'Consolas, Monaco, monospace'
  },
  openButton: {
    padding: '8px 16px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500' as const
  },
  errorContainer: {
    display: 'flex',
    gap: '15px',
    padding: '20px',
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    borderRadius: '4px'
  },
  errorIcon: {
    fontSize: '32px',
    color: '#dc3545',
    fontWeight: 'bold' as const
  },
  errorContent: {
    flex: 1
  },
  errorTitle: {
    margin: '0 0 10px 0',
    fontSize: '18px',
    fontWeight: '600' as const,
    color: '#721c24'
  },
  errorMessage: {
    margin: 0,
    fontSize: '14px',
    color: '#721c24'
  }
};
