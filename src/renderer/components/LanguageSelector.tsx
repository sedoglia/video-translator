import React from 'react';
import { LANGUAGES } from '../../shared/types';

interface LanguageSelectorProps {
  sourceLanguage: string;
  targetLanguage: string;
  onSourceLanguageChange: (lang: string) => void;
  onTargetLanguageChange: (lang: string) => void;
  disabled?: boolean;
}

export function LanguageSelector({
  sourceLanguage,
  targetLanguage,
  onSourceLanguageChange,
  onTargetLanguageChange,
  disabled
}: LanguageSelectorProps) {
  return (
    <div style={styles.container}>
      <h3 style={styles.header}>Language Configuration</h3>

      <div style={styles.selectGroup}>
        <div style={styles.selectContainer}>
          <label style={styles.label}>Source Language</label>
          <select
            value={sourceLanguage}
            onChange={(e) => onSourceLanguageChange(e.target.value)}
            disabled={disabled}
            style={styles.select}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.arrow}>→</div>

        <div style={styles.selectContainer}>
          <label style={styles.label}>Target Language</label>
          <select
            value={targetLanguage}
            onChange={(e) => onTargetLanguageChange(e.target.value)}
            disabled={disabled}
            style={styles.select}
          >
            {LANGUAGES.filter(l => l.code !== 'auto').map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
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
  selectGroup: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 'clamp(10px, 2vw, 15px)',
    flexWrap: 'wrap' as const
  },
  selectContainer: {
    flex: '1 1 150px',
    minWidth: '120px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px'
  },
  label: {
    fontSize: 'clamp(12px, 2vw, 14px)',
    fontWeight: '500' as const
  },
  select: {
    padding: 'clamp(8px, 1.5vw, 10px)',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: 'clamp(12px, 2vw, 14px)',
    backgroundColor: 'white'
  },
  arrow: {
    fontSize: 'clamp(20px, 3vw, 24px)',
    color: '#666',
    paddingBottom: 'clamp(8px, 1.5vw, 10px)',
    alignSelf: 'center',
    flexShrink: 0
  }
};
