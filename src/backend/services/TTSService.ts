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
        // Validate that segments have valid timestamps
        const hasValidTimestamps = whisperSegments.every(seg =>
          typeof seg.start === 'number' && !isNaN(seg.start) &&
          typeof seg.end === 'number' && !isNaN(seg.end)
        );

        if (hasValidTimestamps) {
          this.logger.info('Using ADVANCED timestamp-based lip-sync with Whisper segments');
          try {
            await this.synthesizeWithWhisperTimestamps(
              text,
              voice,
              originalAudioPath,
              tempDir,
              outputPath,
              whisperSegments
            );
          } catch (error: any) {
            this.logger.warn('Timestamp-based synthesis failed, falling back to intelligent segmentation', {
              error: error.message
            });
            await this.synthesizeWithIntelligentSegmentation(
              text,
              voice,
              originalAudioPath,
              tempDir,
              outputPath
            );
          }
        } else {
          this.logger.warn('Whisper segments have invalid timestamps, using intelligent segmentation instead');
          await this.synthesizeWithIntelligentSegmentation(
            text,
            voice,
            originalAudioPath,
            tempDir,
            outputPath
          );
        }
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
      translatedLength: translatedText.length,
      translatedTextPreview: translatedText.substring(0, 200)
    });

    // Get original audio duration for final verification
    const originalDuration = await this.getAudioDuration(originalAudioPath);

    // Split translated text into EXACT same number of segments as Whisper
    // This ensures 1:1 mapping and eliminates alignment issues
    const translatedSegments = this.splitTextProportionally(translatedText, whisperSegments.length);

    this.logger.debug('Segment alignment', {
      whisperSegments: whisperSegments.length,
      translatedSegments: translatedSegments.length,
      firstTranslatedSegment: translatedSegments[0]?.substring(0, 100),
      lastTranslatedSegment: translatedSegments[translatedSegments.length - 1]?.substring(0, 100)
    });

    // Align translated segments with Whisper timestamps (should be 1:1 now)
    const alignedSegments = this.alignTranslatedSegmentsWithTimestamps(
      translatedSegments,
      whisperSegments
    );

    this.logger.debug('Aligned segments for processing', { count: alignedSegments.length });

    // Generate TTS for each aligned segment with PRECISE timing and silence insertion
    const segmentAudioFiles: string[] = [];

    // ADAPTIVE RATE CONTROL: Learn optimal TTS rate from first segments
    let adaptiveTtsRate = '+0%'; // Start with normal speed
    const calibrationSamples: Array<{ targetDuration: number; actualDuration: number }> = [];
    const calibrationSegmentCount = Math.min(15, Math.floor(alignedSegments.length * 0.20)); // First 15 segments or 20%

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

      // IMPROVEMENT 1: Reduced threshold from 50ms to 20ms for more natural pauses
      // Even short pauses are important for lip-sync realism
      if (silenceBefore > 0.02) {
        const silenceFile = path.join(tempDir, `silence_${i}.wav`);
        await this.generateSilence(silenceFile, silenceBefore);
        segmentAudioFiles.push(silenceFile);

        this.logger.debug(`Added ${silenceBefore.toFixed(3)}s silence before segment ${i + 1}`);
      }

      // Skip TTS generation for placeholder segments (single space or empty)
      if (text.trim().length === 0) {
        // Generate silence for the entire segment duration
        const silenceFile = path.join(tempDir, `placeholder_silence_${i}.wav`);
        await this.generateSilence(silenceFile, targetDuration);
        segmentAudioFiles.push(silenceFile);

        this.logger.debug(`Placeholder segment ${i + 1}: using ${targetDuration.toFixed(3)}s silence`);
        continue;
      }

      const segmentFile = path.join(tempDir, `ts_segment_${i}.mp3`);
      const segmentWav = path.join(tempDir, `ts_segment_${i}.wav`);

      // ADAPTIVE RATE: After calibration phase, use learned optimal rate
      if (i === calibrationSegmentCount && calibrationSamples.length > 0) {
        // Calculate average duration ratio from calibration samples
        const avgTargetDuration = calibrationSamples.reduce((sum, s) => sum + s.targetDuration, 0) / calibrationSamples.length;
        const avgActualDuration = calibrationSamples.reduce((sum, s) => sum + s.actualDuration, 0) / calibrationSamples.length;
        const durationRatio = avgActualDuration / avgTargetDuration;

        // Calculate variance to detect inconsistent calibration
        const variance = calibrationSamples.reduce((sum, s) => {
          const ratio = s.actualDuration / s.targetDuration;
          return sum + Math.pow(ratio - durationRatio, 2);
        }, 0) / calibrationSamples.length;
        const stdDev = Math.sqrt(variance);

        // Calculate needed rate adjustment
        // Edge TTS rate works as playback speed: +50% = faster, -50% = slower
        // If TTS is too fast (ratio < 1), need negative rate to slow down
        // If TTS is too slow (ratio > 1), need positive rate to speed up
        const rateAdjustment = (durationRatio - 1) * 100; // Convert to percentage

        // Edge TTS supports rate from -100% to +200%
        // Use moderate limits: -100% to +100% to avoid extreme distortion
        // If variance is high (stdDev > 0.3), disable rate control (too inconsistent)
        let clampedRate = 0;
        if (stdDev < 0.3) {
          clampedRate = Math.max(-100, Math.min(100, rateAdjustment));
        }

        adaptiveTtsRate = clampedRate === 0 ? '+0%' : `${clampedRate > 0 ? '+' : ''}${Math.round(clampedRate)}%`;

        this.logger.info('Adaptive TTS rate calibrated', {
          calibrationSamples: calibrationSamples.length,
          avgTargetDuration: avgTargetDuration.toFixed(2) + 's',
          avgActualDuration: avgActualDuration.toFixed(2) + 's',
          durationRatio: durationRatio.toFixed(3),
          variance: variance.toFixed(3),
          stdDev: stdDev.toFixed(3),
          calculatedRate: adaptiveTtsRate,
          rateLimited: Math.abs(rateAdjustment) > 100,
          varianceTooHigh: stdDev >= 0.3
        });
      }

      // Generate TTS with adaptive rate
      await this.generateSpeechEdgeTTSWithRate(text, voice, segmentFile, adaptiveTtsRate);

      // Convert to WAV
      await this.convertToWav(segmentFile, segmentWav);

      // Get actual duration
      const actualDuration = await this.getAudioDuration(segmentWav);

      // Collect calibration samples from first segments (before adaptive rate kicks in)
      if (i < calibrationSegmentCount) {
        calibrationSamples.push({
          targetDuration,
          actualDuration
        });
      }

      // IMPROVEMENT 4: Ultra-precise time-stretching with 1ms threshold
      // ALWAYS time-stretch to match exact timestamp duration for perfect sync
      // Even tiny mismatches accumulate across many segments, so we must be precise
      const stretchedFile = path.join(tempDir, `ts_stretched_${i}.wav`);
      const difference = Math.abs(targetDuration - actualDuration);
      const needsStretching = difference > 0.001; // Only skip if within 1ms (ultra-precise)

      if (needsStretching) {
        // Time-stretch to exact target duration
        // No padding - let cross-fade handle transitions between segments
        await this.timeStretchAudio(segmentWav, stretchedFile, targetDuration, actualDuration);
        segmentAudioFiles.push(stretchedFile);
        fs.unlinkSync(segmentWav);
      } else {
        // Duration is already perfect, use as-is
        segmentAudioFiles.push(segmentWav);
      }

      // Clean up MP3
      fs.unlinkSync(segmentFile);

      // Calculate speech rate for logging
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
      const wordsPerSecond = wordCount / targetDuration;

      this.logger.debug(`Segment ${i + 1}/${alignedSegments.length} processed`, {
        text: text.substring(0, 50),
        targetDuration: targetDuration.toFixed(3),
        actualDuration: actualDuration.toFixed(3),
        difference: difference.toFixed(4) + 's',
        stretched: needsStretching,
        speechRate: wordsPerSecond.toFixed(1) + ' wps',
        ttsRate: adaptiveTtsRate,
        calibrationPhase: i < calibrationSegmentCount,
        silenceBefore: silenceBefore.toFixed(3)
      });
    }

    // Add final silence if needed (from last segment end to total duration)
    const lastSegment = alignedSegments[alignedSegments.length - 1];
    const finalSilence = originalDuration - lastSegment.endTime;
    if (finalSilence > 0.02) {
      const silenceFile = path.join(tempDir, `silence_final.wav`);
      await this.generateSilence(silenceFile, finalSilence);
      segmentAudioFiles.push(silenceFile);
      this.logger.debug(`Added ${finalSilence.toFixed(3)}s final silence`);
    }

    // Log total files to concatenate for debugging
    this.logger.debug('Concatenating audio files', {
      totalFiles: segmentAudioFiles.length,
      expectedSegments: alignedSegments.length,
      expectedSilences: '~' + alignedSegments.length
    });

    // Concatenate all segments WITH silences
    await this.concatenateAudioFiles(segmentAudioFiles, outputPath);

    // Final duration check
    const finalDuration = await this.getAudioDuration(outputPath);
    const durationDiff = Math.abs(finalDuration - originalDuration);
    this.logger.info('Ultra-precise timestamp-based synthesis complete', {
      originalDuration: originalDuration.toFixed(2),
      finalDuration: finalDuration.toFixed(2),
      difference: durationDiff.toFixed(2) + 's',
      differencePercent: (durationDiff / originalDuration * 100).toFixed(2) + '%',
      segments: alignedSegments.length,
      accuracy: (100 - (durationDiff / originalDuration * 100)).toFixed(2) + '%',
      filesConcat: segmentAudioFiles.length
    });

    // Apply final time-stretch to match exact duration if there's any mismatch
    // This handles accumulated rounding errors and any stretch failures
    if (durationDiff > 0.1) { // Only adjust if difference > 100ms
      this.logger.info('Applying final time-stretch adjustment', {
        currentDuration: finalDuration.toFixed(2),
        targetDuration: originalDuration.toFixed(2),
        adjustment: durationDiff.toFixed(2) + 's'
      });

      const adjustedFile = path.join(tempDir, 'ts_final_adjusted.wav');
      await this.timeStretchAudio(outputPath, adjustedFile, originalDuration, finalDuration);
      fs.copyFileSync(adjustedFile, outputPath);
      fs.unlinkSync(adjustedFile);

      const newDuration = await this.getAudioDuration(outputPath);
      this.logger.info('Final adjustment complete', {
        finalDuration: newDuration.toFixed(2),
        targetDuration: originalDuration.toFixed(2),
        remainingDiff: Math.abs(newDuration - originalDuration).toFixed(3) + 's'
      });
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
        '-i', `anullsrc=channel_layout=mono:sample_rate=44100`,
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

    // Validate whisper segments have valid timestamps
    const invalidSegments = whisperSegments.filter((seg, idx) => {
      const hasValidStart = typeof seg.start === 'number' && !isNaN(seg.start);
      const hasValidEnd = typeof seg.end === 'number' && !isNaN(seg.end);
      if (!hasValidStart || !hasValidEnd) {
        this.logger.warn(`Invalid timestamp in Whisper segment ${idx}`, {
          start: seg.start,
          end: seg.end,
          text: seg.text?.substring(0, 50)
        });
        return true;
      }
      return false;
    });

    if (invalidSegments.length > 0) {
      throw new Error(`Found ${invalidSegments.length} Whisper segments with invalid timestamps. Cannot perform timestamp-based alignment.`);
    }

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
      // More Whisper segments than translated - map each Whisper to nearest translated
      strategy = 'reverse nearest mapping (fewer translated segments)';

      // First, create a mapping of which translated segment each Whisper segment belongs to
      const ratio = translatedSegments.length / whisperSegments.length;
      const whisperToTranslated: number[] = [];

      for (let i = 0; i < whisperSegments.length; i++) {
        const translatedIdx = Math.min(
          Math.floor(i * ratio),
          translatedSegments.length - 1
        );
        whisperToTranslated.push(translatedIdx);
      }

      // Group consecutive Whisper segments that map to the same translated segment
      for (let transIdx = 0; transIdx < translatedSegments.length; transIdx++) {
        // Find all Whisper segments that map to this translated segment
        const whisperIndices: number[] = [];
        for (let i = 0; i < whisperToTranslated.length; i++) {
          if (whisperToTranslated[i] === transIdx) {
            whisperIndices.push(i);
          }
        }

        if (whisperIndices.length > 0) {
          // Use the time range from first to last Whisper segment in this group
          const firstWhisperIdx = whisperIndices[0];
          const lastWhisperIdx = whisperIndices[whisperIndices.length - 1];

          aligned.push({
            text: translatedSegments[transIdx],
            startTime: whisperSegments[firstWhisperIdx].start,
            endTime: whisperSegments[lastWhisperIdx].end
          });
        }
      }
    } else {
      // More translated segments than Whisper - map to nearest Whisper segments
      strategy = 'nearest mapping (more translated segments)';

      // Calculate which Whisper segment each translated segment should map to
      const ratio = whisperSegments.length / translatedSegments.length;

      for (let i = 0; i < translatedSegments.length; i++) {
        // Find the nearest Whisper segment for this translated segment
        const whisperIdx = Math.min(
          Math.floor(i * ratio),
          whisperSegments.length - 1
        );

        // Use that Whisper segment's timing directly
        aligned.push({
          text: translatedSegments[i],
          startTime: whisperSegments[whisperIdx].start,
          endTime: whisperSegments[whisperIdx].end
        });
      }

      // Fix overlaps by adjusting timestamps
      // If segments overlap (share same Whisper timing), subdivide the time
      for (let i = 0; i < aligned.length - 1; i++) {
        const current = aligned[i];
        const next = aligned[i + 1];

        // Check if they overlap (same or overlapping Whisper segment)
        if (next.startTime < current.endTime) {
          // Find all segments that map to this same time range
          const groupStart = i;
          let groupEnd = i + 1;

          while (groupEnd < aligned.length && aligned[groupEnd].startTime < current.endTime) {
            groupEnd++;
          }

          // Subdivide the time range among these segments
          const rangeStart = current.startTime;
          const rangeEnd = current.endTime;
          const rangeDuration = rangeEnd - rangeStart;
          const segmentsInRange = groupEnd - groupStart;

          // Calculate total text length in this range
          const groupSegments = aligned.slice(groupStart, groupEnd);
          const totalTextLength = groupSegments.reduce((sum, seg) => sum + seg.text.length, 0);

          // Redistribute time based on text length
          let cumulativeTime = rangeStart;
          for (let j = groupStart; j < groupEnd; j++) {
            const textProportion = aligned[j].text.length / totalTextLength;
            const duration = rangeDuration * textProportion;

            aligned[j].startTime = cumulativeTime;
            aligned[j].endTime = cumulativeTime + duration;
            cumulativeTime += duration;
          }

          // Skip the segments we just processed
          i = groupEnd - 1;
        }
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
      firstSegment: {
        start: aligned[0]?.startTime.toFixed(2),
        end: aligned[0]?.endTime.toFixed(2),
        text: aligned[0]?.text?.substring(0, 50)
      },
      lastSegment: {
        start: aligned[aligned.length - 1]?.startTime.toFixed(2),
        end: aligned[aligned.length - 1]?.endTime.toFixed(2),
        text: aligned[aligned.length - 1]?.text?.substring(0, 50)
      },
      totalDuration: (aligned[aligned.length - 1]?.endTime - aligned[0]?.startTime).toFixed(2) + 's',
      hasIssues: hasOverlaps || hasLargeGaps
    });

    return aligned;
  }

  /**
   * Split text into exact number of segments proportionally
   * This ensures 1:1 mapping with Whisper segments for perfect alignment
   * GUARANTEES to return exactly targetSegmentCount segments
   */
  private splitTextProportionally(text: string, targetSegmentCount: number): string[] {
    if (targetSegmentCount <= 0) {
      return [text];
    }

    if (targetSegmentCount === 1) {
      return [text];
    }

    const result: string[] = [];
    const totalChars = text.length;
    const charsPerSegment = totalChars / targetSegmentCount;

    let currentPos = 0;

    for (let i = 0; i < targetSegmentCount; i++) {
      // Calculate the ideal end position for this segment
      const idealEndPos = Math.round((i + 1) * charsPerSegment);

      if (i === targetSegmentCount - 1) {
        // Last segment - take all remaining text
        const segment = text.substring(currentPos).trim();
        result.push(segment.length > 0 ? segment : ' '); // Never return empty
      } else {
        // Find the best break point near idealEndPos
        let breakPos = idealEndPos;

        // Search window: ±20% of segment size
        const searchWindow = Math.floor(charsPerSegment * 0.2);
        const searchStart = Math.max(currentPos + 1, idealEndPos - searchWindow);
        const searchEnd = Math.min(totalChars - 1, idealEndPos + searchWindow);

        // Try to find a good break point in order of preference
        const breakChars = ['. ', '! ', '? ', '; ', ', ', ' ', '.', '!', '?', ';', ','];
        let bestBreakPos = -1;
        let bestBreakScore = Infinity;

        for (const breakChar of breakChars) {
          let searchPos = searchStart;
          while (searchPos < searchEnd) {
            const pos = text.indexOf(breakChar, searchPos);
            if (pos === -1 || pos >= searchEnd) break;

            // Score based on distance from ideal and quality of break
            const distance = Math.abs(pos - idealEndPos);
            const score = distance;

            if (score < bestBreakScore) {
              bestBreakScore = score;
              bestBreakPos = pos + breakChar.length;
            }

            searchPos = pos + 1;
          }

          // If we found a good break, use it
          if (bestBreakPos !== -1 && bestBreakScore < searchWindow) {
            break;
          }
        }

        if (bestBreakPos !== -1) {
          breakPos = bestBreakPos;
        }

        // Ensure we don't go past the text
        breakPos = Math.min(breakPos, totalChars);

        // Ensure we make progress
        if (breakPos <= currentPos) {
          breakPos = Math.min(currentPos + Math.ceil(charsPerSegment), totalChars);
        }

        const segment = text.substring(currentPos, breakPos).trim();
        result.push(segment.length > 0 ? segment : ' '); // Never return empty
        currentPos = breakPos;
      }
    }

    // GUARANTEE: Always return exactly targetSegmentCount segments
    while (result.length < targetSegmentCount) {
      result.push(' ');
    }

    if (result.length > targetSegmentCount) {
      result.splice(targetSegmentCount);
    }

    return result;
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
  /**
   * IMPROVEMENT: Concatenate audio files with cross-fade for seamless transitions
   * Uses acrossfade filter to eliminate clicks/pops between segments
   */
  private async concatenateAudioFiles(audioFiles: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Add all input files
      audioFiles.forEach(file => {
        command.input(file);
      });

      // IMPROVEMENT: Use cross-fade between segments for smooth transitions
      // acrossfade eliminates clicks/pops and creates natural-sounding audio flow
      const crossfadeDuration = 0.010; // 10ms crossfade (subtle but effective)

      if (audioFiles.length === 1) {
        // Single file - no crossfade needed
        const filterComplex = `[0:a]anull[outa]`;
        command.complexFilter(filterComplex);
      } else {
        // Build crossfade chain: [0][1]xfade[a1]; [a1][2]xfade[a2]; ...
        const filters: string[] = [];
        let previousLabel = '0:a';

        for (let i = 1; i < audioFiles.length; i++) {
          const currentLabel = i === audioFiles.length - 1 ? 'outa' : `a${i}`;
          // acrossfade: d=duration, c1/c2=curve (tri=triangular for smooth transition)
          filters.push(`[${previousLabel}][${i}:a]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri[${currentLabel}]`);
          previousLabel = currentLabel;
        }

        command.complexFilter(filters.join(';'));
      }

      command
        .outputOptions(['-map', '[outa]'])
        .toFormat('wav')
        .audioChannels(1)
        .audioFrequency(44100)
        .on('start', (cmd) => {
          this.logger.debug('Concatenating audio with cross-fade', {
            segments: audioFiles.length,
            crossfadeDuration: crossfadeDuration + 's',
            command: cmd.substring(0, 200)
          });
        })
        .on('end', () => {
          this.logger.debug('Audio concatenation with cross-fade complete');
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
   * Generate speech using Microsoft Edge TTS with rate control (Neural voices)
   */
  private async generateSpeechEdgeTTSWithRate(text: string, voice: string, outputPath: string, rate: string = '+0%'): Promise<void> {
    try {
      // Sanitize and validate text
      const sanitizedText = text.trim();

      if (!sanitizedText || sanitizedText.length === 0) {
        throw new Error('Empty text provided to Edge TTS');
      }

      this.logger.debug('Generating audio with Edge TTS', {
        voice,
        rate,
        textLength: sanitizedText.length,
        textPreview: sanitizedText.substring(0, 100)
      });

      const tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

      // Pass rate as ProsodyOptions (second parameter to toStream)
      const prosodyOptions = rate !== '+0%' ? { rate } : undefined;
      const streams = tts.toStream(sanitizedText, prosodyOptions);
      const writable = fs.createWriteStream(outputPath);

      let bytesWritten = 0;

      // Pipe the TTS audio stream to file
      await new Promise<void>((resolve, reject) => {
        streams.audioStream.on('data', (chunk: Buffer) => {
          bytesWritten += chunk.length;
        });

        streams.audioStream.pipe(writable);

        writable.on('finish', () => {
          this.logger.debug('Edge TTS stream finished', { bytesWritten, rate });
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
        rate,
        textLength: sanitizedText.length
      });
    } catch (error: any) {
      this.logger.error('Edge TTS generation failed', {
        error: error.message,
        voice,
        rate,
        textPreview: text.substring(0, 100)
      });
      throw error;
    }
  }

  /**
   * Generate speech using Microsoft Edge TTS (Neural voices)
   */
  private async generateSpeechEdgeTTS(text: string, voice: string, outputPath: string): Promise<void> {
    try {
      // Sanitize and validate text
      const sanitizedText = text.trim();

      if (!sanitizedText || sanitizedText.length === 0) {
        throw new Error('Empty text provided to Edge TTS');
      }

      this.logger.debug('Generating audio with Edge TTS', {
        voice,
        textLength: sanitizedText.length,
        textPreview: sanitizedText.substring(0, 100),
        fullText: sanitizedText // Log full text to debug
      });

      const tts = new MsEdgeTTS();
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

      const streams = tts.toStream(sanitizedText);
      const writable = fs.createWriteStream(outputPath);

      let bytesWritten = 0;

      // Track bytes written
      writable.on('pipe', () => {
        this.logger.debug('Edge TTS stream started piping');
      });

      // Pipe the TTS audio stream to file
      await new Promise<void>((resolve, reject) => {
        streams.audioStream.on('data', (chunk: Buffer) => {
          bytesWritten += chunk.length;
          this.logger.debug(`Edge TTS data chunk received: ${chunk.length} bytes (total: ${bytesWritten})`);
        });

        streams.audioStream.pipe(writable);

        writable.on('finish', () => {
          this.logger.debug('Edge TTS stream finished', { bytesWritten });
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

        streams.audioStream.on('end', () => {
          this.logger.debug('Edge TTS audio stream ended', { bytesWritten });
        });
      });

      // Verify file was created and has content
      if (!fs.existsSync(outputPath)) {
        throw new Error('Edge TTS output file was not created');
      }

      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        this.logger.error('Edge TTS created empty file - diagnosis', {
          textLength: sanitizedText.length,
          text: sanitizedText,
          voice,
          bytesWrittenFromStream: bytesWritten,
          outputPath
        });
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

    // For ultra-precise lip-sync, we need to stretch even tiny differences
    // Removed the 5% threshold - every mismatch must be corrected

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

  /**
   * Helper method to get padding duration based on speech rate
   */
  private getPaddingForRate(wordsPerSecond: number): string {
    if (wordsPerSecond > 4.5) return '2ms';
    if (wordsPerSecond >= 3.5) return '3ms';
    if (wordsPerSecond < 2.5) return '8ms';
    return '5ms';
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
