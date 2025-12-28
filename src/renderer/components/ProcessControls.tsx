import React from 'react';
import type { GPUInfo } from '../../shared/types';

interface ProcessControlsProps {
  useCuda: boolean;
  onUseCudaChange: (useCuda: boolean) => void;
  outputDir: string;
  onOutputDirChange: (dir: string) => void;
  onProcess: () => void;
  onCancel: () => void;
  processing: boolean;
  gpuInfo: GPUInfo | null;
}

export function ProcessControls({
  useCuda,
  onUseCudaChange,
  outputDir,
  onOutputDirChange,
  onProcess,
  onCancel,
  processing,
  gpuInfo
}: ProcessControlsProps) {
  const handleSelectFolder = async () => {
    if (window.electronAPI) {
      const dir = await window.electronAPI.selectFolder();
      if (dir) {
        onOutputDirChange(dir);
      }
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.header}>Processing Options</h3>

      <div style={styles.optionRow}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={useCuda}
            onChange={(e) => onUseCudaChange(e.target.checked)}
            disabled={processing || !gpuInfo?.cudaAvailable}
            style={styles.checkbox}
          />
          Use GPU CUDA (if available)
        </label>
        <span style={styles.gpuStatus}>
          {gpuInfo?.cudaAvailable
            ? `✓ ${gpuInfo.gpuName}`
            : '✗ No CUDA GPU detected'}
        </span>
      </div>

      <div style={styles.inputGroup}>
        <label style={styles.label}>Output Directory</label>
        <div style={styles.pathInput}>
          <input
            type="text"
            value={outputDir}
            onChange={(e) => onOutputDirChange(e.target.value)}
            disabled={processing}
            style={styles.input}
          />
          <button onClick={handleSelectFolder} disabled={processing} style={styles.browseButton}>
            Browse...
          </button>
        </div>
      </div>

      <div style={styles.buttonGroup}>
        <button
          onClick={onProcess}
          disabled={processing}
          style={{
            ...styles.button,
            ...styles.processButton,
            ...(processing ? styles.buttonDisabled : {})
          }}
        >
          {processing ? 'Processing...' : 'Process Video'}
        </button>

        {processing && (
          <button onClick={onCancel} style={{ ...styles.button, ...styles.cancelButton }}>
            Cancel
          </button>
        )}
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
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    marginBottom: '15px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  },
  gpuStatus: {
    fontSize: '13px',
    color: '#666',
    fontStyle: 'italic' as const
  },
  inputGroup: {
    marginBottom: '15px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500' as const,
    marginBottom: '5px'
  },
  pathInput: {
    display: 'flex',
    gap: '10px'
  },
  input: {
    flex: 1,
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px'
  },
  browseButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px'
  },
  button: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: '600' as const,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  processButton: {
    flex: 1,
    backgroundColor: '#007bff',
    color: 'white'
  },
  cancelButton: {
    backgroundColor: '#dc3545',
    color: 'white'
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed'
  }
};
