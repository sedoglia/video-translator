import React, { useState } from 'react';

interface VideoInputProps {
  onSourceChange: (source: 'local' | 'youtube') => void;
  onFileChange: (path: string) => void;
  onUrlChange: (url: string) => void;
  disabled?: boolean;
}

export function VideoInput({ onSourceChange, onFileChange, onUrlChange, disabled }: VideoInputProps) {
  const [source, setSource] = useState<'local' | 'youtube'>('local');
  const [filePath, setFilePath] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const handleSourceChange = (newSource: 'local' | 'youtube') => {
    setSource(newSource);
    onSourceChange(newSource);
  };

  const handleSelectFile = async () => {
    if (window.electronAPI) {
      const path = await window.electronAPI.selectFile();
      if (path) {
        setFilePath(path);
        onFileChange(path);
      }
    }
  };

  const handleUrlChange = (url: string) => {
    setYoutubeUrl(url);
    onUrlChange(url);
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.header}>Video Source</h3>

      <div style={styles.toggleContainer}>
        <button
          style={{
            ...styles.toggleButton,
            ...(source === 'local' ? styles.toggleButtonActive : {})
          }}
          onClick={() => handleSourceChange('local')}
          disabled={disabled}
        >
          Local File
        </button>
        <button
          style={{
            ...styles.toggleButton,
            ...(source === 'youtube' ? styles.toggleButtonActive : {})
          }}
          onClick={() => handleSourceChange('youtube')}
          disabled={disabled}
        >
          YouTube URL
        </button>
      </div>

      {source === 'local' ? (
        <div style={styles.inputGroup}>
          <input
            type="text"
            value={filePath}
            placeholder="No file selected"
            readOnly
            style={styles.input}
          />
          <button onClick={handleSelectFile} disabled={disabled} style={styles.browseButton}>
            Browse...
          </button>
        </div>
      ) : (
        <div style={styles.inputGroup}>
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            disabled={disabled}
            style={styles.input}
          />
        </div>
      )}
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
  toggleContainer: {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px'
  },
  toggleButton: {
    flex: 1,
    padding: '10px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#ccc',
    backgroundColor: '#f5f5f5',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '14px',
    transition: 'all 0.2s'
  },
  toggleButtonActive: {
    backgroundColor: '#007bff',
    color: 'white',
    borderColor: '#007bff'
  },
  inputGroup: {
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
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  }
};
