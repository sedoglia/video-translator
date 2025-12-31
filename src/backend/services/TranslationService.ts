import { JobLogger } from '../utils/logger';
import { translate } from '@vitalets/google-translate-api';

export class TranslationService {
  constructor(private logger: JobLogger) {
  }

  async translate(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    this.logger.stage('TRANSLATING', `Translating from ${sourceLanguage} to ${targetLanguage}`);

    // If source and target are the same, no translation needed
    if (sourceLanguage === targetLanguage) {
      this.logger.stage('TRANSLATING', 'Source and target languages are the same, skipping translation');
      return text;
    }

    // Use Google Translate with retry logic
    const translated = await this.translateWithGoogle(text, sourceLanguage, targetLanguage);

    // Google Translate API returns properly encoded UTF-8 text
    // Italian accented characters (à,è,ì,ò,ù,é,á) are preserved correctly
    this.logger.stage('TRANSLATING', `Translation complete (${translated.length} chars)`);
    return translated;
  }

  private async translateWithGoogle(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    this.logger.debug('Using Google Translate', { from: sourceLanguage, to: targetLanguage, textLength: text.length });

    // Implement retry logic with exponential backoff for rate limiting and connection errors
    const maxRetries = 5; // Increased from 3
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff: 3s, 6s, 12s, 24s, 48s
          const delay = 3000 * Math.pow(2, attempt - 1);
          this.logger.info(`Retrying Google Translate after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`, {
            previousError: lastError?.message
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Split text into chunks if too long (Google Translate has limits)
        const maxChunkSize = 5000;
        if (text.length <= maxChunkSize) {
          this.logger.debug('Sending translation request to Google', { textLength: text.length });
          const result = await translate(text, {
            from: sourceLanguage,
            to: targetLanguage,
            fetchOptions: {
              timeout: 30000 // 30 second timeout
            }
          });
          this.logger.debug('Google Translate succeeded', { resultLength: result.text.length });
          return result.text;
        }

        // For long texts, translate in chunks
        this.logger.debug('Text too long, using chunked translation');
        return await this.translateLongText(text, sourceLanguage, targetLanguage);
      } catch (error: any) {
        lastError = error;
        this.logger.warn(`Google Translate attempt ${attempt + 1}/${maxRetries} failed`, {
          error: error.message,
          errorType: error.constructor.name,
          errorCode: error.code,
          willRetry: attempt < maxRetries - 1
        });

        // Retry on network errors, rate limiting, or timeout
        if (error.message && (
          error.message.includes('Too Many Requests') ||
          error.message.includes('ECONNRESET') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('request') ||
          error.message.includes('fetch') ||
          error.message.includes('failed')
        )) {
          continue; // Retry
        } else {
          throw error; // Other errors, don't retry
        }
      }
    }

    // All retries failed
    this.logger.error('All Google Translate retries exhausted', { lastError: lastError?.message });
    throw lastError;
  }

  private async translateLongText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    const maxChunkSize = 5000;

    // For long texts, split by sentences and translate in chunks
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = '';
    const translatedChunks: string[] = [];

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChunkSize) {
        // Translate current chunk
        if (currentChunk) {
          if (translatedChunks.length > 0) {
            // Add delay between chunks to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          const result = await translate(currentChunk, { from: sourceLanguage, to: targetLanguage });
          translatedChunks.push(result.text);
        }
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    // Translate remaining chunk
    if (currentChunk) {
      if (translatedChunks.length > 0) {
        // Add delay between chunks to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      const result = await translate(currentChunk, { from: sourceLanguage, to: targetLanguage });
      translatedChunks.push(result.text);
    }

    return translatedChunks.join(' ');
  }

  async detectLanguage(text: string): Promise<string> {
    try {
      // Use Google Translate language detection
      const result = await translate(text.substring(0, 1000), { to: 'en' });
      // The new version returns raw response with detected language
      if (result.raw && Array.isArray(result.raw) && result.raw[2]) {
        return result.raw[2]; // Language code
      }
    } catch (error) {
      this.logger.warn('Google language detection failed', { error });
    }

    return 'en'; // Default fallback
  }

  /**
   * Ensure proper UTF-8 encoding by detecting and fixing double-encoding issues
   * This fixes UTF-8 text that was incorrectly interpreted as Windows-1252/Latin1
   * NOTE: Currently unused - kept for reference
   */
  private ensureUtf8Encoding(text: string): string {
    try {
      // Check for UTF-8 double-encoding corruption by looking for suspicious byte sequences
      // When UTF-8 is interpreted as Latin1, multi-byte characters become multiple Latin1 chars

      // Common indicators of UTF-8 corruption:
      // - Char codes > 127 followed by specific patterns
      // - Multiple consecutive chars in the 192-255 range (C0-FF)
      let suspiciousSequences = 0;

      for (let i = 0; i < text.length - 1; i++) {
        const code = text.charCodeAt(i);
        const nextCode = text.charCodeAt(i + 1);

        // UTF-8 two-byte sequence (C0-DF followed by 80-BF)
        if (code >= 0xC0 && code <= 0xDF && nextCode >= 0x80 && nextCode <= 0xBF) {
          suspiciousSequences++;
        }
        // UTF-8 three-byte sequence start (E0-EF)
        else if (code >= 0xE0 && code <= 0xEF) {
          suspiciousSequences++;
        }
      }

      // If we find multiple suspicious sequences, likely double-encoded
      if (suspiciousSequences < 3) {
        return text; // Looks clean, no fix needed
      }

      // Attempt to fix by re-encoding as latin1 then decoding as utf8
      const buffer = Buffer.from(text, 'latin1');
      const fixed = buffer.toString('utf8');

      this.logger.info('Fixed UTF-8 double-encoding corruption', {
        originalLength: text.length,
        fixedLength: fixed.length,
        suspiciousSequences,
        originalPreview: text.substring(0, 100),
        fixedPreview: fixed.substring(0, 100)
      });

      return fixed;
    } catch (error: any) {
      this.logger.warn('Failed to fix encoding, returning original text', { error: error.message });
      return text;
    }
  }
}
