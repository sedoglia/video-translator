import React, { useState, useEffect } from 'react';
import { VideoInput } from './components/VideoInput';
import { LanguageSelector } from './components/LanguageSelector';
import { ProcessControls } from './components/ProcessControls';
import { ProgressDisplay } from './components/ProgressDisplay';
import { ResultPanel } from './components/ResultPanel';
import { useVideoProcessor } from './hooks/useVideoProcessor';

export function App() {
  const [source, setSource] = useState<'local' | 'youtube'>('local');
  const [filePath, setFilePath] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [useCuda, setUseCuda] = useState(true);
  const [outputDir, setOutputDir] = useState('');

  // Set default output directory on mount
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getDefaultOutputPath().then(defaultPath => {
        setOutputDir(defaultPath);
      });
    }
  }, []);

  const {
    processing,
    currentStage,
    progress,
    logs,
    result,
    gpuInfo,
    startProcessing,
    cancelProcessing,
    clearLogs
  } = useVideoProcessor();

  const handleProcess = () => {
    // Validation
    if (source === 'local' && !filePath) {
      alert('Please select a video file');
      return;
    }

    if (source === 'youtube' && !youtubeUrl) {
      alert('Please enter a YouTube URL');
      return;
    }

    if (!targetLanguage || targetLanguage === 'auto') {
      alert('Please select a target language');
      return;
    }

    // Start processing
    startProcessing({
      source,
      inputPath: source === 'local' ? filePath : undefined,
      youtubeUrl: source === 'youtube' ? youtubeUrl : undefined,
      sourceLanguage,
      targetLanguage,
      useCuda,
      outputDir
    });
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Video Audio Translator</h1>
        <p style={styles.subtitle}>
          Translate video audio to any language using AI
        </p>
      </header>

      <main style={styles.main}>
        <div style={styles.section}>
          <VideoInput
            onSourceChange={setSource}
            onFileChange={setFilePath}
            onUrlChange={setYoutubeUrl}
            disabled={processing}
          />

          <LanguageSelector
            sourceLanguage={sourceLanguage}
            targetLanguage={targetLanguage}
            onSourceLanguageChange={setSourceLanguage}
            onTargetLanguageChange={setTargetLanguage}
            disabled={processing}
          />

          <ProcessControls
            useCuda={useCuda}
            onUseCudaChange={setUseCuda}
            outputDir={outputDir}
            onOutputDirChange={setOutputDir}
            onProcess={handleProcess}
            onCancel={cancelProcessing}
            processing={processing}
            gpuInfo={gpuInfo}
          />
        </div>

        <div style={styles.section}>
          <ProgressDisplay
            stage={currentStage}
            progress={progress}
            logs={logs}
            onClearLogs={clearLogs}
          />

          <ResultPanel result={result} />
        </div>
      </main>

      <footer style={styles.footer}>
        <p style={styles.footerText}>
          Powered by Whisper.cpp, Google Translate, and Microsoft Edge TTS
        </p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    height: '100vh',
    backgroundColor: '#f8f9fa',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden'
  },
  header: {
    backgroundColor: '#343a40',
    color: 'white',
    padding: 'clamp(15px, 3vw, 20px) clamp(20px, 4vw, 30px)',
    borderBottom: '3px solid #007bff',
    flexShrink: 0
  },
  title: {
    margin: '0 0 5px 0',
    fontSize: 'clamp(20px, 4vw, 28px)',
    fontWeight: '700' as const
  },
  subtitle: {
    margin: 0,
    fontSize: 'clamp(12px, 2vw, 14px)',
    opacity: 0.9
  },
  main: {
    flex: 1,
    padding: 'clamp(15px, 3vw, 30px)',
    maxWidth: '1400px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box' as const,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const
  },
  section: {
    backgroundColor: 'white',
    padding: 'clamp(15px, 3vw, 25px)',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: 'clamp(15px, 2vw, 20px)'
  },
  footer: {
    backgroundColor: '#343a40',
    color: 'white',
    padding: 'clamp(10px, 2vw, 15px) clamp(20px, 4vw, 30px)',
    textAlign: 'center' as const,
    flexShrink: 0
  },
  footerText: {
    margin: 0,
    fontSize: 'clamp(10px, 1.5vw, 12px)',
    opacity: 0.8
  }
};
