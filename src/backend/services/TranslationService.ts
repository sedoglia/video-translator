import axios from 'axios';
import { JobLogger } from '../utils/logger';
import { translate } from '@vitalets/google-translate-api';

export class TranslationService {
  private libreTranslateUrl: string;
  private apiKey?: string;

  constructor(private logger: JobLogger) {
    this.libreTranslateUrl = process.env.LIBRETRANSLATE_URL || 'http://localhost:5000';
    this.apiKey = process.env.LIBRETRANSLATE_API_KEY;
  }

  async translate(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    this.logger.stage('TRANSLATING', `Translating from ${sourceLanguage} to ${targetLanguage}`);

    // If source and target are the same, no translation needed
    if (sourceLanguage === targetLanguage) {
      this.logger.stage('TRANSLATING', 'Source and target languages are the same, skipping translation');
      return text;
    }

    try {
      // Try Google Translate first (free, no API key needed)
      const translated = await this.translateWithGoogle(text, sourceLanguage, targetLanguage);
      this.logger.stage('TRANSLATING', `Translation complete (${translated.length} chars)`);
      return translated;
    } catch (googleError: any) {
      this.logger.warn('Google Translate failed, trying LibreTranslate', { error: googleError.message });

      try {
        // Fallback to LibreTranslate
        const translated = await this.translateWithLibreTranslate(text, sourceLanguage, targetLanguage);
        this.logger.stage('TRANSLATING', `Translation complete via LibreTranslate (${translated.length} chars)`);
        return translated;
      } catch (libreError: any) {
        this.logger.error('All translation services failed', {
          googleError: googleError.message,
          libreError: libreError.message
        });
        // Last fallback: return original text
        this.logger.warn('Returning original text without translation');
        return text;
      }
    }
  }

  private async translateWithGoogle(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    this.logger.debug('Using Google Translate', { from: sourceLanguage, to: targetLanguage });

    // Implement retry logic with exponential backoff for rate limiting
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff: 5s, 10s, 20s
          const delay = 5000 * Math.pow(2, attempt - 1);
          this.logger.debug(`Retrying Google Translate after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Split text into chunks if too long (Google Translate has limits)
        const maxChunkSize = 5000;
        if (text.length <= maxChunkSize) {
          const result = await translate(text, { from: sourceLanguage, to: targetLanguage });
          return result.text;
        }

        // For long texts, translate in chunks
        return await this.translateLongText(text, sourceLanguage, targetLanguage);
      } catch (error: any) {
        lastError = error;
        if (error.message && error.message.includes('Too Many Requests')) {
          this.logger.warn(`Rate limited by Google (attempt ${attempt + 1}/${maxRetries})`);
          continue; // Retry
        } else {
          throw error; // Other errors, don't retry
        }
      }
    }

    // All retries failed
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

  private async translateWithLibreTranslate(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    const payload: any = {
      q: text,
      source: sourceLanguage,
      target: targetLanguage,
      format: 'text'
    };

    if (this.apiKey) {
      payload.api_key = this.apiKey;
    }

    const response = await axios.post(`${this.libreTranslateUrl}/translate`, payload, {
      timeout: 30000
    });

    if (response.data && response.data.translatedText) {
      return response.data.translatedText;
    }

    throw new Error('Invalid response from LibreTranslate');
  }

  async detectLanguage(text: string): Promise<string> {
    try {
      // Try Google Translate detect first
      const result = await translate(text.substring(0, 1000), { to: 'en' });
      // The new version returns raw response with detected language
      if (result.raw && Array.isArray(result.raw) && result.raw[2]) {
        return result.raw[2]; // Language code
      }
    } catch (error) {
      this.logger.debug('Google language detection failed, trying LibreTranslate', { error });
    }

    try {
      // Fallback to LibreTranslate
      const payload: any = {
        q: text.substring(0, 1000) // Limit to first 1000 chars for detection
      };

      if (this.apiKey) {
        payload.api_key = this.apiKey;
      }

      const response = await axios.post(`${this.libreTranslateUrl}/detect`, payload, {
        timeout: 10000
      });

      if (response.data && response.data.length > 0) {
        return response.data[0].language;
      }
    } catch (error) {
      this.logger.debug('LibreTranslate detection failed', { error });
    }

    return 'en'; // Default fallback
  }
}
