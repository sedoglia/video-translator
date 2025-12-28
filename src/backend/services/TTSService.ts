import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { JobLogger } from '../utils/logger';
import { LANGUAGES } from '../../shared/types';
import ffmpeg from 'fluent-ffmpeg';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

interface AudioSegment {
  text: string;
  duration: number;
  silenceDuration: number;
}

export class TTSService {
  constructor(private logger: JobLogger) {}

  async synthesize(
    text: string,
    targetLanguage: string,
    outputPath: string,
    originalAudioPath?: string,
    whisperSegments?: any[] // Whisper segments with timestamps for precision lip-sync
  ): Promise<string> {
    this.logger.stage('SYNTHESIZING', `Generating TTS for language: ${targetLanguage}`);

    try {
      const tempDir = path.dirname(outputPath);
      const tempAudioPath = path.join(tempDir, 'tts_temp.mp3');
      const tempProcessedPath = path.join(tempDir, 'tts_processed.wav');

      // Get Edge TTS voice for language
      const voice = this.getEdgeVoiceForLanguage(targetLanguage);

      this.logger.debug('Generating speech with Edge TTS', {
        voice,
        textLength: text.length,
        hasWhisperSegments: !!whisperSegments,
        segmentsCount: whisperSegments?.length || 0
      });

      // If we have Whisper segments with timestamps, use advanced timestamp-based lip-sync
      if (originalAudioPath && fs.existsSync(originalAudioPath) && whisperSegments && whisperSegments.length > 0) {
        this.logger.info('Using ADVANCED timestamp-based lip-sync with Whisper segments');
        await this.synthesizeWithWhisperTimestamps(
          text,
          voice,
          originalAudioPath,
          tempDir,
          outputPath,
          whisperSegments
        );
      } else if (originalAudioPath && fs.existsSync(originalAudioPath)) {
        // Fallback to intelligent segmentation if no Whisper segments
        this.logger.info('Using intelligent segmentation for lip-sync (no Whisper segments)');
        await this.synthesizeWithIntelligentSegmentation(
          text,
          voice,
          originalAudioPath,
          tempDir,
          outputPath
        );
      } else {
        // No original audio, generate normally
        await this.generateSpeechEdgeTTS(text, voice, tempAudioPath);
        await this.convertToWav(tempAudioPath, outputPath);

        if (fs.existsSync(tempAudioPath)) {
          fs.unlinkSync(tempAudioPath);
        }
      }

      this.logger.stage('SYNTHESIZING', `TTS synthesis complete: ${outputPath}`);

      return outputPath;
    } catch (error: any) {
      this.logger.error('TTS synthesis failed', { error: error.message });
      throw new Error(`TTS synthesis failed: ${error.message}`);
    }
  }

  /**
   * Synthesize with intelligent segmentation for better lip-sync
   * Segments text based on punctuation and matches timing to original audio
   */
  private async synthesizeWithIntelligentSegmentation(
    text: string,
    voice: string,
    originalAudioPath: string,
    tempDir: string,
    outputPath: string
  ): Promise<void> {
    this.logger.debug('Using intelligent segmentation for better lip-sync');

    // Get original audio duration
    const originalDuration = await this.getAudioDuration(originalAudioPath);

    // Segment text intelligently
    const segments = this.segmentTextIntelligently(text);
    this.logger.debug('Text segmented', {
      segments: segments.length,
      originalDuration
    });

    // Calculate target duration per segment (proportional to text length)
    const totalTextLength = segments.reduce((sum, seg) => sum + seg.length, 0);

    // Generate TTS for each segment
    const segmentAudioFiles: string[] = [];
    let currentTime = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentFile = path.join(tempDir, `segment_${i}.mp3`);
      const segmentWav = path.join(tempDir, `segment_${i}.wav`);

      // Generate TTS for this segment
      await this.generateSpeechEdgeTTS(segment, voice, segmentFile);

      // Convert to WAV
      await this.convertToWav(segmentFile, segmentWav);

      // Get actual duration
      const segmentDuration = await this.getAudioDuration(segmentWav);

      // Calculate target duration based on proportion of text
      const textProportion = segment.length / totalTextLength;
      const targetDuration = originalDuration * textProportion;

      // Apply time-stretch if needed
      const stretchedFile = path.join(tempDir, `stretched_${i}.wav`);
      if (Math.abs(targetDuration - segmentDuration) / targetDuration > 0.05) {
        await this.timeStretchAudio(segmentWav, stretchedFile, targetDuration, segmentDuration);
        segmentAudioFiles.push(stretchedFile);

        // Clean up intermediate files
        fs.unlinkSync(segmentWav);
      } else {
        segmentAudioFiles.push(segmentWav);
      }

      // Clean up MP3
      fs.unlinkSync(segmentFile);

      currentTime += targetDuration;
    }

    // Concatenate all segments
    await this.concatenateAudioFiles(segmentAudioFiles, outputPath);

    // Final time-stretch to match exact duration
    const finalDuration = await this.getAudioDuration(outputPath);
    if (Math.abs(finalDuration - originalDuration) / originalDuration > 0.02) {
      const adjustedFile = path.join(tempDir, 'final_adjusted.wav');
      await this.timeStretchAudio(outputPath, adjustedFile, originalDuration, finalDuration);
      fs.copyFileSync(adjustedFile, outputPath);
      fs.unlinkSync(adjustedFile);
    }

    // Clean up segment files
    segmentAudioFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

    this.logger.debug('Segmented synthesis complete', {
      originalDuration,
      finalDuration: await this.getAudioDuration(outputPath)
    });
  }

  /**
   * ADVANCED: Synthesize with Whisper timestamp-based segmentation
   * Uses actual word/phrase timestamps from Whisper for maximum precision
   * WITH SILENCE INSERTION for perfect pause preservation
   */
  private async synthesizeWithWhisperTimestamps(
    translatedText: string,
    voice: string,
    originalAudioPath: string,
    tempDir: string,
    outputPath: string,
    whisperSegments: any[]
  ): Promise<void> {
    this.logger.info('Starting ULTRA-PRECISE timestamp-based synthesis with silence insertion', {
      segments: whisperSegments.length,
      translatedLength: translatedText.length
    });

    // Get original audio duration for final verification
    const originalDuration = await this.getAudioDuration(originalAudioPath);

    // Split translated text into sentences/phrases (we'll match them to whisper segments)
    const translatedSegments = this.segmentTextIntelligently(translatedText);

    this.logger.debug('Segment alignment', {
      whisperSegments: whisperSegments.length,
      translatedSegments: translatedSegments.length
    });

    // Align translated segments with Whisper timestamps
    // If counts don't match perfectly, distribute proportionally
    const alignedSegments = this.alignTranslatedSegmentsWithTimestamps(
      translatedSegments,
      whisperSegments
    );

    this.logger.debug('Aligned segments for processing', { count: alignedSegments.length });

    // Generate TTS for each aligned segment with PRECISE timing and silence insertion
    const segmentAudioFiles: string[] = [];

    for (let i = 0; i < alignedSegments.length; i++) {
      const { text, startTime, endTime } = alignedSegments[i];
      const targetDuration = endTime - startTime;

      // Calculate silence BEFORE this segment (from previous segment end to this segment start)
      let silenceBefore = 0;
      if (i > 0) {
        const previousEnd = alignedSegments[i - 1].endTime;
        silenceBefore = startTime - previousEnd;
      } else {
        // First segment - add silence from 0 to startTime
        silenceBefore = startTime;
      }

      // Only add silence if it's significant (> 50ms)
      if (silenceBefore > 0.05) {
        const silenceFile = path.join(tempDir, `silence_${i}.wav`);
        await this.generateSilence(silenceFile, silenceBefore);
        segmentAudioFiles.push(silenceFile);

        this.logger.debug(`Added ${silenceBefore.toFixed(2)}s silence before segment ${i + 1}`);
      }

      const segmentFile = path.join(tempDir, `ts_segment_${i}.mp3`);
      const segmentWav = path.join(tempDir, `ts_segment_${i}.wav`);

      // Generate TTS for this segment
      await this.generateSpeechEdgeTTS(text, voice, segmentFile);

      // Convert to WAV
      await this.convertToWav(segmentFile, segmentWav);

      // Get actual duration
      const actualDuration = await this.getAudioDuration(segmentWav);

      // Time-stretch to match exact timestamp duration
      const stretchedFile = path.join(tempDir, `ts_stretched_${i}.wav`);
      if (Math.abs(targetDuration - actualDuration) / targetDuration > 0.03) { // 3% threshold
        await this.timeStretchAudio(segmentWav, stretchedFile, targetDuration, actualDuration);
        segmentAudioFiles.push(stretchedFile);
        fs.unlinkSync(segmentWav);
      } else {
        segmentAudioFiles.push(segmentWav);
      }

      // Clean up MP3
      fs.unlinkSync(segmentFile);

      this.logger.debug(`Segment ${i + 1}/${alignedSegments.length} processed`, {
        text: text.substring(0, 50),
        targetDuration: targetDuration.toFixed(2),
        actualDuration: actualDuration.toFixed(2),
        silenceBefore: silenceBefore.toFixed(2)
      });
    }

    // Add final silence if needed (from last segment end to total duration)
    const lastSegment = alignedSegments[alignedSegments.length - 1];
    const finalSilence = originalDuration - lastSegment.endTime;
    if (finalSilence > 0.05) {
      const silenceFile = path.join(tempDir, `silence_final.wav`);
      await this.generateSilence(silenceFile, finalSilence);
      segmentAudioFiles.push(silenceFile);
      this.logger.debug(`Added ${finalSilence.toFixed(2)}s final silence`);
    }

    // Concatenate all segments WITH silences
    await this.concatenateAudioFiles(segmentAudioFiles, outputPath);

    // Final duration check
    const finalDuration = await this.getAudioDuration(outputPath);
    this.logger.info('Ultra-precise timestamp-based synthesis complete', {
      originalDuration: originalDuration.toFixed(2),
      finalDuration: finalDuration.toFixed(2),
      difference: Math.abs(finalDuration - originalDuration).toFixed(2) + 's',
      segments: alignedSegments.length,
      accuracy: (100 - (Math.abs(finalDuration - originalDuration) / originalDuration * 100)).toFixed(2) + '%'
    });

    // Fine-tune final duration if needed (should be VERY minimal with silence insertion)
    if (Math.abs(finalDuration - originalDuration) / originalDuration > 0.01) { // 1% threshold (stricter)
      const adjustedFile = path.join(tempDir, 'ts_final_adjusted.wav');
      await this.timeStretchAudio(outputPath, adjustedFile, originalDuration, finalDuration);
      fs.copyFileSync(adjustedFile, outputPath);
      fs.unlinkSync(adjustedFile);

      this.logger.debug('Applied micro-adjustment for perfect sync');
    }

    // Clean up segment files
    segmentAudioFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  }

  /**
   * Generate silence audio file with exact duration
   */
  private async generateSilence(outputPath: string, durationSeconds: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-f', 'lavfi',
        '-i', `anullsrc=channel_layout=mono:sample_rate=16000`,
        '-t', durationSeconds.toString(),
        '-acodec', 'pcm_s16le',
        '-y',
        outputPath
      ];

      execFile('ffmpeg', args, (error: Error | null) => {
        if (error) {
          reject(new Error(`Failed to generate silence: ${error.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Align translated text segments with Whisper timestamp segments
   */
  private alignTranslatedSegmentsWithTimestamps(
    translatedSegments: string[],
    whisperSegments: any[]
  ): Array<{ text: string; startTime: number; endTime: number }> {
    const aligned: Array<{ text: string; startTime: number; endTime: number }> = [];
    let strategy: string;

    if (translatedSegments.length === whisperSegments.length) {
      // Perfect 1:1 alignment
      strategy = '1:1 perfect match';
      for (let i = 0; i < translatedSegments.length; i++) {
        aligned.push({
          text: translatedSegments[i],
          startTime: whisperSegments[i].start,
          endTime: whisperSegments[i].end
        });
      }
    } else if (translatedSegments.length < whisperSegments.length) {
      // More Whisper segments than translated - group Whisper segments
      strategy = 'grouping (fewer translated segments)';
      const ratio = whisperSegments.length / translatedSegments.length;

      for (let i = 0; i < translatedSegments.length; i++) {
        const startIdx = Math.floor(i * ratio);
        const endIdx = Math.min(Math.floor((i + 1) * ratio), whisperSegments.length);

        aligned.push({
          text: translatedSegments[i],
          startTime: whisperSegments[startIdx].start,
          endTime: whisperSegments[Math.min(endIdx, whisperSegments.length - 1)].end
        });
      }
    } else {
      // More translated segments than Whisper - distribute time proportionally
      strategy = 'proportional distribution (more translated segments)';
      const totalTime = whisperSegments[whisperSegments.length - 1].end - whisperSegments[0].start;
      const totalTextLength = translatedSegments.reduce((sum, seg) => sum + seg.length, 0);
      let currentTime = whisperSegments[0].start;

      for (let i = 0; i < translatedSegments.length; i++) {
        const textProportion = translatedSegments[i].length / totalTextLength;
        const duration = totalTime * textProportion;

        aligned.push({
          text: translatedSegments[i],
          startTime: currentTime,
          endTime: currentTime + duration
        });

        currentTime += duration;
      }
    }

    // Verify temporal continuity and log details
    let hasOverlaps = false;
    let hasLargeGaps = false;
    for (let i = 1; i < aligned.length; i++) {
      const gap = aligned[i].startTime - aligned[i - 1].endTime;
      if (gap < 0) {
        this.logger.warn(`Segment overlap in alignment: ${i - 1} → ${i}`, {
          gap: gap.toFixed(3) + 's'
        });
        hasOverlaps = true;
      }
      if (gap > 5) { // Gap > 5 seconds
        this.logger.warn(`Large gap in alignment: ${i - 1} → ${i}`, {
          gap: gap.toFixed(3) + 's'
        });
        hasLargeGaps = true;
      }
    }

    this.logger.info('Segment alignment complete', {
      strategy,
      translatedCount: translatedSegments.length,
      whisperCount: whisperSegments.length,
      alignedCount: aligned.length,
      firstSegment: { start: aligned[0]?.startTime.toFixed(2), end: aligned[0]?.endTime.toFixed(2) },
      lastSegment: { start: aligned[aligned.length - 1]?.startTime.toFixed(2), end: aligned[aligned.length - 1]?.endTime.toFixed(2) },
      totalDuration: (aligned[aligned.length - 1]?.endTime - aligned[0]?.startTime).toFixed(2) + 's',
      hasIssues: hasOverlaps || hasLargeGaps
    });

    return aligned;
  }

  /**
   * Segment text intelligently based on punctuation and natural breaks
   */
  private segmentTextIntelligently(text: string): string[] {
    // First split on strong punctuation (., !, ?)
    const sentences = text
      .split(/([.!?]+(?:\s+|$))/)
      .filter(s => s.trim().length > 0)
      .reduce((acc: string[], curr, idx, arr) => {
        // Combine text with following punctuation
        if (idx % 2 === 0) {
          const punct = arr[idx + 1] || '';
          acc.push((curr + punct).trim());
        }
        return acc;
      }, []);

    // Further split long sentences on commas, semicolons
    const segments: string[] = [];
    for (const sentence of sentences) {
      if (sentence.length > 150) {
        // Split long sentences
        const parts = sentence
          .split(/([,;:]+\s+)/)
          .filter(s => s.trim().length > 0)
          .reduce((acc: string[], curr, idx, arr) => {
            if (idx % 2 === 0) {
              const punct = arr[idx + 1] || '';
              acc.push((curr + punct).trim());
            }
            return acc;
          }, []);
        segments.push(...parts);
      } else {
        segments.push(sentence);
      }
    }

    return segments.filter(s => s.length > 0);
  }

  /**
   * Concatenate multiple audio files into one
   */
  private async concatenateAudioFiles(audioFiles: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Add all input files
      audioFiles.forEach(file => {
        command.input(file);
      });

      // Create filter complex for concatenation
      const filterParts: string[] = [];
      audioFiles.forEach((_, index) => {
        filterParts.push(`[${index}:a]`);
      });
      const filterComplex = `${filterParts.join('')}concat=n=${audioFiles.length}:v=0:a=1[outa]`;

      command
        .complexFilter(filterComplex)
        .outputOptions(['-map', '[outa]'])
        .toFormat('wav')
        .audioChannels(1)
        .audioFrequency(44100)
        .on('start', (cmd) => {
          this.logger.debug('Concatenating audio segments', {
            segments: audioFiles.length,
            command: cmd
          });
        })
        .on('end', () => {
          this.logger.debug('Audio concatenation complete');
          resolve();
        })
        .on('error', (err: Error) => {
          this.logger.error('Audio concatenation failed', { error: err.message });
          reject(err);
        })
        .save(outputPath);
    });
  }

  /**
   * Generate speech using Microsoft Edge TTS (Neural voices)
   */
  private async generateSpeechEdgeTTS(text: string, voice: string, outputPath: string): Promise<void> {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

      this.logger.debug('Generating audio with Edge TTS', {
        voice,
        textPreview: text.substring(0, 100)
      });

      const streams = tts.toStream(text);
      const writable = fs.createWriteStream(outputPath);

      // Pipe the TTS audio stream to file
      await new Promise<void>((resolve, reject) => {
        streams.audioStream.pipe(writable);

        writable.on('finish', () => {
          this.logger.debug('Edge TTS stream finished');
          resolve();
        });

        writable.on('error', (error: Error) => {
          this.logger.error('Error writing TTS stream', { error: error.message });
          reject(error);
        });

        streams.audioStream.on('error', (error: Error) => {
          this.logger.error('Error reading TTS stream', { error: error.message });
          reject(error);
        });
      });

      // Verify file was created and has content
      if (!fs.existsSync(outputPath)) {
        throw new Error('Edge TTS output file was not created');
      }

      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('Edge TTS created an empty file');
      }

      this.logger.debug('Edge TTS synthesis complete', {
        outputSize: stats.size,
        outputPath
      });
    } catch (error: any) {
      this.logger.error('Edge TTS generation failed', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Edge TTS failed: ${error.message}`);
    }
  }

  /**
   * Get Microsoft Edge Neural voice for language
   * These are high-quality neural voices available via Edge TTS
   */
  private getEdgeVoiceForLanguage(languageCode: string): string {
    const voiceMap: Record<string, string> = {
      'en': 'en-US-JennyNeural',
      'it': 'it-IT-ElsaNeural',
      'es': 'es-ES-ElviraNeural',
      'fr': 'fr-FR-DeniseNeural',
      'de': 'de-DE-KatjaNeural',
      'pt': 'pt-PT-RaquelNeural',
      'ja': 'ja-JP-NanamiNeural',
      'zh': 'zh-CN-XiaoxiaoNeural',
      'ko': 'ko-KR-SunHiNeural',
      'ru': 'ru-RU-SvetlanaNeural',
      'ar': 'ar-SA-ZariyahNeural',
      'hi': 'hi-IN-SwaraNeural',
      'nl': 'nl-NL-ColetteNeural',
      'pl': 'pl-PL-ZofiaNeural',
      'tr': 'tr-TR-EmelNeural',
      'sv': 'sv-SE-SofieNeural',
      'no': 'nb-NO-PernilleNeural',
      'da': 'da-DK-ChristelNeural',
      'fi': 'fi-FI-NooraNeural',
      'el': 'el-GR-AthinaNeural',
      'cs': 'cs-CZ-VlastaNeural',
      'hu': 'hu-HU-NoemiNeural',
      'ro': 'ro-RO-AlinaNeural',
      'th': 'th-TH-PremwadeeNeural',
      'vi': 'vi-VN-HoaiMyNeural',
      'id': 'id-ID-GadisNeural',
      'he': 'he-IL-HilaNeural',
      'uk': 'uk-UA-PolinaNeural',
      'ca': 'ca-ES-JoanaNeural'
    };

    return voiceMap[languageCode] || 'en-US-JennyNeural'; // Default to English
  }

  private async convertToWav(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('wav')
        .audioChannels(1)
        .audioFrequency(44100) // High quality: 44.1kHz
        .audioBitrate('256k')
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .save(outputPath);
    });
  }

  private async getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });
  }

  private async timeStretchAudio(
    inputPath: string,
    outputPath: string,
    targetDuration: number,
    currentDuration: number
  ): Promise<void> {
    // Calculate tempo adjustment factor
    const tempo = currentDuration / targetDuration;

    // Limit tempo to reasonable range (0.5 to 2.0) to preserve audio quality
    const clampedTempo = Math.max(0.5, Math.min(2.0, tempo));

    if (Math.abs(clampedTempo - 1.0) < 0.05) {
      // Less than 5% difference, no need to stretch
      this.logger.debug('Duration difference negligible, skipping time-stretch');
      fs.copyFileSync(inputPath, outputPath);
      return;
    }

    this.logger.debug('Applying time-stretch', {
      targetDuration,
      currentDuration,
      tempo: clampedTempo
    });

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters([
          // Use atempo filter for time-stretching without pitch change
          this.getAtempoFilter(clampedTempo)
        ])
        .on('end', () => {
          this.logger.debug('Time-stretch complete');
          resolve();
        })
        .on('error', (err: Error) => {
          this.logger.error('Time-stretch failed', { error: err.message });
          reject(err);
        })
        .save(outputPath);
    });
  }

  private getAtempoFilter(tempo: number): string {
    // FFmpeg atempo filter only supports 0.5 to 2.0 range
    if (tempo >= 0.5 && tempo <= 2.0) {
      return `atempo=${tempo.toFixed(3)}`;
    } else if (tempo < 0.5) {
      // For very slow speeds, chain multiple atempo filters
      return `atempo=0.5,atempo=${(tempo / 0.5).toFixed(3)}`;
    } else {
      // For very fast speeds, chain multiple atempo filters
      return `atempo=2.0,atempo=${(tempo / 2.0).toFixed(3)}`;
    }
  }
}
