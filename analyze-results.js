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

const content = fs.readFileSync(latestLog.path, 'utf8');
const lines = content.split('\n');

// Extract key metrics
let calibrationRate = null;
let accuracy = null;
let originalDuration = null;
let finalDuration = null;
let difference = null;
let strategy = null;
let segmentCount = null;

for (const line of lines) {
  try {
    if (line.includes('Adaptive TTS rate calibrated')) {
      const match = line.match(/"calculatedRate":"([^"]+)"/);
      if (match) calibrationRate = match[1];

      const samplesMatch = line.match(/"calibrationSamples":(\d+)/);
      const avgTargetMatch = line.match(/"avgTargetDuration":"([^"]+)"/);
      const avgActualMatch = line.match(/"avgActualDuration":"([^"]+)"/);
      const ratioMatch = line.match(/"durationRatio":"([^"]+)"/);

      if (samplesMatch) {
        console.log('📊 Calibration Phase:');
        console.log('  Samples:', samplesMatch[1]);
        if (avgTargetMatch) console.log('  Avg Target:', avgTargetMatch[1]);
        if (avgActualMatch) console.log('  Avg Actual:', avgActualMatch[1]);
        if (ratioMatch) console.log('  Duration Ratio:', ratioMatch[1]);
        console.log('  Calculated Rate:', calibrationRate);
        console.log('');
      }
    }

    if (line.includes('Ultra-precise timestamp-based synthesis complete')) {
      const accMatch = line.match(/"accuracy":"([^"]+)"/);
      if (accMatch) accuracy = accMatch[1];

      const origMatch = line.match(/"originalDuration":"([^"]+)"/);
      if (origMatch) originalDuration = origMatch[1];

      const finalMatch = line.match(/"finalDuration":"([^"]+)"/);
      if (finalMatch) finalDuration = finalMatch[1];

      const diffMatch = line.match(/"difference":"([^"]+)"/);
      if (diffMatch) difference = diffMatch[1];

      const segMatch = line.match(/"segments":(\d+)/);
      if (segMatch) segmentCount = segMatch[1];
    }

    if (line.includes('Segment alignment complete')) {
      const stratMatch = line.match(/"strategy":"([^"]+)"/);
      if (stratMatch) strategy = stratMatch[1];
    }
  } catch (e) {
    // Skip malformed lines
  }
}

console.log('📈 Results:');
console.log('  Strategy:', strategy || 'N/A');
console.log('  Segments:', segmentCount || 'N/A');
console.log('  Calibration Rate:', calibrationRate || 'N/A');
console.log('');

console.log('⏱️  Duration:');
console.log('  Original:', originalDuration || 'N/A');
console.log('  Final:', finalDuration || 'N/A');
console.log('  Difference:', difference || 'N/A');
console.log('');

console.log('🎯 Accuracy:', accuracy ? accuracy + '%' : 'N/A');

if (accuracy) {
  const acc = parseFloat(accuracy);
  console.log('');
  if (acc >= 95) {
    console.log('✅ SUCCESS - Accuracy >= 95%');
    console.log('   Adaptive TTS rate control is working perfectly!');
  } else if (acc >= 90) {
    console.log('⚠️  CLOSE - Accuracy >= 90% but < 95%');
    console.log('   May need minor adjustments to calibration or rate limits');
  } else {
    console.log('❌ NEEDS IMPROVEMENT - Accuracy < 90%');
    console.log('   Further investigation required');
  }
}

console.log('\n=== End of Analysis ===');
