export interface TimedText {
  start: number;
  end: number;
  text: string;
}

/**
 * Group consecutive Whisper segments into sentence-level units.
 * A new group starts after sentence-terminating punctuation (.!?…), after a
 * real pause in the speech, or when the merged duration would exceed
 * maxGroupDuration.
 *
 * Why: each group is translated and synthesized as one unit, so it must be a
 * self-contained phrase (Edge TTS prosody, coherent translation) and must not
 * span a pause — otherwise the dubbed voice keeps talking while the speaker
 * on screen is silent.
 */
export function groupSegmentsBySentence(
  segments: TimedText[],
  maxGroupDuration: number = 12,
  pauseThreshold: number = 1.0
): TimedText[] {
  if (segments.length === 0) return [];

  const endsSentence = (text: string): boolean =>
    /[.!?…。！？।]["')\]\s]*$/.test(text);

  const groups: TimedText[] = [];
  let current: TimedText = {
    start: segments[0].start,
    end: segments[0].end,
    text: (segments[0].text || '').trim()
  };

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    const segText = (seg.text || '').trim();
    const shouldClose =
      endsSentence(current.text) ||
      seg.start - current.end > pauseThreshold ||
      seg.end - current.start > maxGroupDuration;

    if (shouldClose) {
      groups.push(current);
      current = { start: seg.start, end: seg.end, text: segText };
    } else {
      current.end = seg.end;
      current.text = (current.text + ' ' + segText).trim();
    }
  }
  groups.push(current);

  return groups.filter(g => g.text.length > 0);
}
