const fs = require('fs');
const path = require('path');

console.log('=== Analyzing Latest Test Results ===\n');

// Find most recent log file
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  console.log('No logs directory found');
  process.exit(1);
}

const logFiles = fs.readdirSync(logsDir)
  .filter(f => f.endsWith('.log'))
  .map(f => ({
    name: f,
    path: path.join(logsDir, f),
    mtime: fs.statSync(path.join(logsDir, f)).mtime
  }))
  .sort((a, b) => b.mtime - a.mtime);

if (logFiles.length === 0) {
  console.log('No log files found');
  process.exit(1);
}

const latestLog = logFiles[0];
console.log('Latest log:', latestLog.name);
console.log('Modified:', latestLog.mtime.toLocaleString());
console.log('');

const allLines = fs.readFileSync(latestLog.path, 'utf8').split('\n');

// The log accumulates every job: analyze only the most recent one that ran TTS
const ttsLine = [...allLines].reverse().find(l => l.includes('Generating TTS for language'));
const jobMatch = ttsLine && ttsLine.match(/\[Job: ([^\]]+)\]/);
if (!jobMatch) {
  console.log('No TTS job found in the latest log.');
  process.exit(1);
}
const jobId = jobMatch[1];
const lines = allLines.filter(l => l.includes(`[Job: ${jobId}]`));
console.log('Job:', jobId);
console.log('');

const fallback = lines.find(l => l.includes('Timestamp-anchored synthesis failed'));
if (fallback) {
  console.log('❌ FAILED - Timestamp-anchored synthesis failed and fell back to intelligent segmentation');
  console.log('   ' + fallback.slice(fallback.indexOf('{')).slice(0, 500));
  process.exit(1);
}

// Parse the JSON payload of the last log line containing `marker`
function lastPayload(marker) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes(marker)) continue;
    const json = lines[i].slice(lines[i].indexOf('{'));
    try {
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }
  return null;
}

const translation = lastPayload('Translated phrase by phrase');
const pauses = lastPayload('Snapped phrase boundaries to source pauses');
const synthesis = lastPayload('Timestamp-anchored synthesis complete');

if (!synthesis) {
  console.log('No timestamp-anchored synthesis found in the latest log.');
  console.log('(The video may have been processed without Whisper timestamps.)');
  process.exit(1);
}

console.log('🌍 Translation:');
console.log('  Whisper segments:', translation ? translation.whisperSegments : 'N/A');
console.log('  Phrases translated:', translation ? translation.phrases : 'N/A');
console.log('');

console.log('⏸️  Source pauses:');
console.log('  Silence threshold:', pauses ? pauses.silenceThreshold : 'N/A');
console.log('  Pauses detected:', pauses ? pauses.pausesDetected : 'N/A');
console.log('  Boundaries snapped:', pauses ? pauses.boundariesSnapped : 'N/A');
console.log('');

console.log('🗣️  Synthesis:');
console.log('  Phrases placed:', synthesis.segments);
console.log('  Re-synthesized faster:', synthesis.resynthesizedFaster);
console.log('  Time-stretched:', synthesis.stretched, `(tempo ${synthesis.tempoRange})`);
console.log('');

console.log('⏱️  Timing:');
console.log('  Max phrase delay:', synthesis.maxLateness);
console.log('  Avg phrase delay:', synthesis.avgLateness);
console.log('  Overrun at end:', synthesis.overrunAtEnd);

// A phrase starting late is what the viewer notices: judge on the worst one
const maxLateness = parseFloat(synthesis.maxLateness);
const overrun = parseFloat(synthesis.overrunAtEnd);
console.log('');
if (maxLateness <= 0.5 && overrun === 0) {
  console.log('✅ SUCCESS - Every phrase starts within 0.5s of the original');
} else if (maxLateness <= 1.5) {
  console.log('⚠️  CLOSE - Some phrases start up to 1.5s late');
  console.log('   The translation is much longer than the original in places');
} else {
  console.log('❌ NEEDS IMPROVEMENT - Some phrases start more than 1.5s late');
  console.log('   Check the per-segment "placed" debug lines for the worst offenders');
}

console.log('\n=== End of Analysis ===');
