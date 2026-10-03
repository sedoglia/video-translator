# Lip-sync bench

Measures how well the dubbed audio follows the original speech, so changes to
the translation/TTS alignment (`src/backend/services/TTSService.ts`,
`src/backend/utils/speech-groups.ts`) can be compared with numbers instead of
by ear alone. Downloads, transcripts and generated tracks go to `data/`
(git-ignored).

## Workflow

```bash
# 1. Once per video: download (or use a local file), extract audio, transcribe
npm run bench:prep -- "https://youtu.be/VIDEO_ID"

# 2. Generate a dubbed track with the current code (--mux also writes an .mp4 to listen to)
npm run bench:run -- --name before --mux

# 3. Change the code or the constants at the top of TTSService.ts, then
npm run bench:run -- --name after --mux

# 4. Compare (also accepts any video file, e.g. one produced by the app)
npm run bench:measure -- before after output/video_translated_to_it.mp4
```

Options: `prep` takes `--lang <code>` (default `auto`); `run` takes
`--target <code>` (default `it`) and `--retranslate` (translations are cached
per target language, so by default only the synthesis is re-run); `measure`
takes `--lang <code>`, the language of the dub (default `it`).

## Metrics

| Column | Meaning | Better |
|---|---|---|
| `anchorDrift*` | Numbers and names are the same in both languages: the dub is transcribed with Whisper and each one's time is compared with the original. The fairest measure of *saying the right thing at the right time*. | lower |
| `onsetErrMedian`, `onsetsWithin300ms` | After each real pause in the original, distance between the speaker resuming and the dub resuming. | lower / more |
| `talkDuringSourcePauses` | Share of the speaker's pauses the dub talks through. | lower |
| `srcSpeechCovered` | Share of the original speech time covered by dub speech. | higher |

Pauses are detected in the original audio the same way the pipeline does,
which slightly favors it on the pause metrics; the anchor metric is
independent. Per-phrase details (slot, TTS rate, tempo, lateness) are in
`logs/combined.log` under the job `lipsync-bench-<name>`.
