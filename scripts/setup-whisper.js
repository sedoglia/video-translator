const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

// Configuration
const WHISPER_BIN_DIR = path.join(__dirname, '..', 'whisper-bin');
const MODELS_DIR = path.join(WHISPER_BIN_DIR, 'models');

// Whisper.cpp CUDA binaries configuration
// v1.9.2 is the latest stable release that publishes Windows binaries (later
// tags have no assets). Since 1.7 the CLI is whisper-cli.exe; main.exe is
// only a deprecation stub.
const WHISPER_CPP_RELEASE = 'v1.9.2';
const CUDA_ARCHIVE = {
  url: `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_CPP_RELEASE}/whisper-cublas-12.4.0-bin-x64.zip`,
  size: '~640 MB',
  folder: 'Release' // top-level folder inside the archive
};

// Files the app needs from the archive (the rest are examples and tools).
// ggml-cpu-*.dll are the CPU backends ggml picks from at runtime (also used
// without an NVIDIA GPU, or with GPU disabled).
const REQUIRED_BINARIES = [
  'whisper-cli.exe', 'whisper.dll', 'ggml.dll', 'ggml-base.dll', 'ggml-cuda.dll',
  'cublas64_12.dll', 'cublasLt64_12.dll', 'cudart64_12.dll'
];
const isRequiredBinary = (file) => REQUIRED_BINARIES.includes(file) || /^ggml-cpu-.+\.dll$/.test(file);

const MODELS = {
  tiny: {
    name: 'ggml-tiny.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    size: '75 MB',
    description: 'Fastest model, good for quick testing'
  },
  base: {
    name: 'ggml-base.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    size: '142 MB',
    description: 'Fast model with better accuracy'
  },
  small: {
    name: 'ggml-small.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    size: '466 MB',
    description: 'Good balance of speed and accuracy'
  },
  medium: {
    name: 'ggml-medium.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    size: '1.5 GB',
    description: 'Best accuracy, recommended for production'
  },
  large: {
    name: 'ggml-large-v3.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
    size: '3.1 GB',
    description: 'Highest accuracy, slowest processing'
  }
};

const DEFAULT_MODEL = 'medium';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function downloadFile(url, destinationPath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destinationPath);
    let downloadedBytes = 0;
    let totalBytes = 0;

    https.get(url, (response) => {
      // Handle redirects (GitHub release assets redirect to a CDN)
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        file.close();
        fs.unlinkSync(destinationPath);
        return downloadFile(response.headers.location, destinationPath, onProgress)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      totalBytes = parseInt(response.headers['content-length'], 10);

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (onProgress) {
          onProgress(downloadedBytes, totalBytes);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          log(`\n✓ Download complete!`, colors.green);
          resolve();
        });
      });
    }).on('error', (err) => {
      fs.unlink(destinationPath, () => {});
      reject(err);
    });

    file.on('error', (err) => {
      fs.unlink(destinationPath, () => {});
      reject(err);
    });
  });
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log(`✓ Created directory: ${dirPath}`, colors.green);
  }
}

function listAvailableModels() {
  log('\n' + '='.repeat(70), colors.cyan);
  log('Available Whisper Models:', colors.bright + colors.cyan);
  log('='.repeat(70), colors.cyan);

  Object.entries(MODELS).forEach(([key, model]) => {
    const installed = fs.existsSync(path.join(MODELS_DIR, model.name)) ? '✓' : '✗';
    const installColor = installed === '✓' ? colors.green : colors.yellow;

    log(`\n${installColor}[${installed}] ${key.toUpperCase()}${colors.reset}`, colors.bright);
    log(`    File: ${model.name}`);
    log(`    Size: ${model.size}`);
    log(`    ${model.description}`);

    if (key === DEFAULT_MODEL) {
      log(`    ${colors.blue}(Recommended)${colors.reset}`);
    }
  });

  log('\n' + '='.repeat(70), colors.cyan);
}

async function downloadModel(modelKey) {
  const model = MODELS[modelKey];

  if (!model) {
    log(`✗ Error: Model '${modelKey}' not found.`, colors.red);
    log(`Available models: ${Object.keys(MODELS).join(', ')}`, colors.yellow);
    process.exit(1);
  }

  const modelPath = path.join(MODELS_DIR, model.name);

  // Check if model already exists
  if (fs.existsSync(modelPath)) {
    const stats = fs.statSync(modelPath);
    log(`\n✓ Model '${modelKey}' already exists (${formatBytes(stats.size)})`, colors.green);

    // Ask if user wants to re-download
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      readline.question('Do you want to re-download it? (y/N): ', (answer) => {
        readline.close();

        if (answer.toLowerCase() !== 'y') {
          log('Skipping download.', colors.yellow);
          resolve();
        } else {
          fs.unlinkSync(modelPath);
          log('Existing model deleted.', colors.yellow);
          downloadModelFile(modelKey, modelPath).then(resolve);
        }
      });
    });
  }

  return downloadModelFile(modelKey, modelPath);
}

async function downloadModelFile(modelKey, modelPath) {
  const model = MODELS[modelKey];

  log(`\nDownloading ${modelKey.toUpperCase()} model...`, colors.bright + colors.blue);
  log(`Size: ${model.size}`);
  log(`From: ${model.url}\n`, colors.cyan);

  let lastProgress = 0;

  await downloadFile(model.url, modelPath, (downloaded, total) => {
    const percent = Math.floor((downloaded / total) * 100);

    // Update progress every 1%
    if (percent > lastProgress) {
      lastProgress = percent;
      const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
      process.stdout.write(`\r[${bar}] ${percent}% - ${formatBytes(downloaded)} / ${formatBytes(total)}`);
    }
  });

  // Verify file was downloaded correctly
  const stats = fs.statSync(modelPath);
  log(`\n✓ Model saved to: ${modelPath}`, colors.green);
  log(`✓ File size: ${formatBytes(stats.size)}`, colors.green);
}

function checkGPUSupport() {
  log('\nChecking GPU support...', colors.cyan);

  try {
    // Try to detect NVIDIA GPU using nvidia-smi
    execSync('nvidia-smi', { stdio: 'ignore' });
    log('✓ NVIDIA GPU detected!', colors.green);
    log('  CUDA acceleration will be available for faster processing.', colors.green);
    return true;
  } catch (error) {
    log('✗ No NVIDIA GPU detected.', colors.yellow);
    log('  CPU-only mode will be used (slower).', colors.yellow);
    return false;
  }
}

function checkCudaBinaries() {
  log('\nChecking Whisper.cpp CUDA binaries...', colors.cyan);

  const missingFiles = [];

  for (const file of REQUIRED_BINARIES) {
    const filePath = path.join(WHISPER_BIN_DIR, file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length === 0) {
    log('✓ All CUDA binaries found!', colors.green);
    return true;
  } else {
    log(`✗ Missing CUDA binaries: ${missingFiles.join(', ')}`, colors.yellow);
    if (fs.existsSync(path.join(WHISPER_BIN_DIR, 'main.exe'))) {
      log(`  Found binaries from an older Whisper.cpp release: they will be replaced with ${WHISPER_CPP_RELEASE}.`, colors.yellow);
    }
    return false;
  }
}

async function downloadAndExtractZip(url, destDir, onProgress) {
  const tempZipPath = path.join(destDir, 'temp_download.zip');
  const extractDir = path.join(destDir, 'temp_extract');

  try {
    // Download ZIP file
    await downloadFile(url, tempZipPath, onProgress);

    log('\nExtracting archive...', colors.cyan);

    // Use PowerShell to extract on Windows (built-in, no external dependencies)
    const extractCommand = `powershell -NoProfile -command "Expand-Archive -Path '${tempZipPath}' -DestinationPath '${extractDir}' -Force"`;

    try {
      execSync(extractCommand, { stdio: 'ignore' });
    } catch (error) {
      log('✗ Failed to extract archive with PowerShell', colors.red);
      throw new Error('Extraction failed. Please extract manually or ensure PowerShell is available.');
    }
    log('✓ Archive extracted successfully!', colors.green);

    const releaseDir = path.join(extractDir, CUDA_ARCHIVE.folder);
    if (!fs.existsSync(releaseDir)) {
      throw new Error(`Unexpected archive layout: '${CUDA_ARCHIVE.folder}' folder not found`);
    }

    // Copy only what the app needs into whisper-bin
    for (const file of fs.readdirSync(releaseDir).filter(isRequiredBinary)) {
      fs.copyFileSync(path.join(releaseDir, file), path.join(destDir, file));
      log(`  ✓ Installed ${file}`, colors.green);
    }

    // main.exe from older releases would be picked up by mistake: remove it
    const legacyMain = path.join(destDir, 'main.exe');
    if (fs.existsSync(legacyMain)) {
      fs.unlinkSync(legacyMain);
      log('  ✓ Removed legacy main.exe', colors.green);
    }
  } finally {
    // Clean up temp files
    if (fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
    }
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
}

async function downloadCudaBinaries() {
  log('\n' + '='.repeat(70), colors.cyan);
  log('Downloading Whisper.cpp CUDA Binaries', colors.bright + colors.cyan);
  log('='.repeat(70), colors.cyan);

  log('\nThis will download the official Whisper.cpp binaries with CUDA support.', colors.reset);
  log('Required for GPU acceleration (NVIDIA GPUs only).', colors.reset);
  log(`Release: ${WHISPER_CPP_RELEASE} (${CUDA_ARCHIVE.size})`, colors.cyan);

  const zipUrl = CUDA_ARCHIVE.url;

  log(`\nDownloading from: ${zipUrl}\n`, colors.cyan);

  let lastProgress = 0;

  await downloadAndExtractZip(zipUrl, WHISPER_BIN_DIR, (downloaded, total) => {
    const percent = Math.floor((downloaded / total) * 100);

    if (percent > lastProgress) {
      lastProgress = percent;
      const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
      process.stdout.write(`\r[${bar}] ${percent}% - ${formatBytes(downloaded)} / ${formatBytes(total)}`);
    }
  });

  log('\n✓ CUDA binaries installed successfully!', colors.green);
}

async function setupCudaBinariesIfNeeded() {
  if (!checkCudaBinaries()) {
    log('\nCUDA binaries are required for GPU acceleration.', colors.yellow);
    log('Without them, the application will not work properly.', colors.yellow);

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise((resolve) => {
      readline.question('\nDownload CUDA binaries now? (Y/n): ', (answer) => {
        readline.close();
        resolve(answer.trim().toLowerCase() || 'y');
      });
    });

    if (answer === 'y' || answer === 'yes') {
      try {
        await downloadCudaBinaries();

        // Verify installation
        if (checkCudaBinaries()) {
          log('\n✓ All required binaries are now installed!', colors.green);
        } else {
          log('\n✗ Some binaries are still missing.', colors.red);
          log('Please check the whisper-bin/README.md for manual installation instructions.', colors.yellow);
        }
      } catch (error) {
        log(`\n✗ Error downloading binaries: ${error.message}`, colors.red);
        log('\nYou can download them manually from:', colors.yellow);
        log(`  ${CUDA_ARCHIVE.url}`, colors.cyan);
        log('\nSee whisper-bin/README.md for detailed instructions.', colors.yellow);
      }
    } else {
      log('\nSkipping CUDA binaries download.', colors.yellow);
      log('You can run this setup again later or download manually.', colors.yellow);
      log('See whisper-bin/README.md for instructions.', colors.cyan);
    }
  }
}

function displayUsageInstructions(modelKey) {
  log('\n' + '='.repeat(70), colors.green);
  log('Setup Complete!', colors.bright + colors.green);
  log('='.repeat(70), colors.green);

  log(`\n✓ Whisper model '${modelKey}' is ready to use.`, colors.green);
  log('\nTo start the application:', colors.bright);
  log('  npm start', colors.cyan);

  log('\nThe application will automatically use the downloaded model.', colors.reset);

  if (modelKey !== DEFAULT_MODEL) {
    log(`\nNote: You downloaded the '${modelKey}' model.`, colors.yellow);
    log(`The application is configured to use '${DEFAULT_MODEL}' by default.`, colors.yellow);
    log(`Update WhisperService.ts if you want to use a different model.`, colors.yellow);
  }

  log('\n' + '='.repeat(70), colors.green);
}

async function main() {
  log('\n' + '='.repeat(70), colors.bright + colors.blue);
  log('Whisper Model Setup Tool', colors.bright + colors.blue);
  log('='.repeat(70) + '\n', colors.bright + colors.blue);

  // Ensure directories exist
  ensureDirectoryExists(WHISPER_BIN_DIR);
  ensureDirectoryExists(MODELS_DIR);

  // Check GPU support
  const hasGPU = checkGPUSupport();

  // IMPORTANT: Setup CUDA binaries FIRST (required for the application to work)
  if (hasGPU) {
    await setupCudaBinariesIfNeeded();
  } else {
    log('\nNote: CUDA binaries are still required even without an NVIDIA GPU.', colors.yellow);
    log('The application will fall back to CPU mode, but binaries must be present.', colors.yellow);
    await setupCudaBinariesIfNeeded();
  }

  // Get model selection from command line argument
  const args = process.argv.slice(2);
  let modelKey = args[0];

  // If no argument, show available models and ask for input
  if (!modelKey) {
    listAvailableModels();

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    modelKey = await new Promise((resolve) => {
      readline.question(`\nWhich model do you want to download? [${DEFAULT_MODEL}]: `, (answer) => {
        readline.close();
        resolve(answer.trim().toLowerCase() || DEFAULT_MODEL);
      });
    });
  }

  // Download the model
  try {
    await downloadModel(modelKey);
    displayUsageInstructions(modelKey);
  } catch (error) {
    log(`\n✗ Error: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  log('\n\nSetup interrupted.', colors.yellow);
  process.exit(0);
});

// Run main function
main().catch((error) => {
  log(`\nFatal error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
