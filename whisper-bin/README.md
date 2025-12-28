# Whisper.cpp CUDA Binaries

This directory contains the Whisper.cpp binaries with CUDA support for GPU acceleration.

## ⭐ Automatic Installation (Recommended)

**The easiest way to get all required binaries:**

```bash
npm run setup
```

This single command will automatically:
- ✅ Check for missing CUDA binaries
- ✅ Download them from official Whisper.cpp releases (~15 MB)
- ✅ Extract and install to this directory
- ✅ Download the Whisper AI model
- ✅ Verify installation

**No manual steps required!** Everything is handled automatically.

---

## Manual Installation (Alternative)

Due to GitHub's file size limitations (100 MB max), the CUDA DLL files are not included in this repository by default.

### Files needed:

- `whisper.dll` - Main Whisper.cpp library
- `cublas64_12.dll` - CUDA BLAS library (~100 MB)
- `cublasLt64_12.dll` - CUDA BLAS Light library (~507 MB)
- `cudart64_12.dll` - CUDA Runtime library

### Download Options:

#### Option 1: Official Whisper.cpp Release (Recommended)
1. Visit: https://github.com/ggerganov/whisper.cpp/releases
2. Download the latest CUDA-enabled release for Windows
3. Extract the DLL files to this directory (`whisper-bin/`)

#### Option 2: Build from Source
1. Clone: https://github.com/ggerganov/whisper.cpp
2. Follow build instructions with CUDA support
3. Copy resulting DLL files to this directory

#### Option 3: CUDA Toolkit (For DLL files only)
1. Download NVIDIA CUDA Toolkit 12.6.0: https://developer.nvidia.com/cuda-downloads
2. After installation, copy the required DLL files from:
   - `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6\bin\`
3. For `whisper.dll`, use Option 1 or 2 above

## Whisper Models

AI models are downloaded automatically by the setup script:
```bash
npm run setup          # Downloads medium model (recommended)
npm run setup:tiny     # Fastest, smaller model
npm run setup:large    # Highest quality, larger model
```

Models are stored in `whisper-bin/models/` and cached after first download.

## Verification

After placing the DLL files, run the application to verify:
- The app will show "✓ CUDA GPU detected" if properly configured
- Check GPU usage in Task Manager during transcription

## GPU Requirements

- NVIDIA GPU with CUDA Compute Capability 3.0+
- NVIDIA Driver 522.06 or newer
- Windows 10/11 64-bit

## Troubleshooting

**GPU not detected:**
- Ensure all DLL files are in the `whisper-bin/` directory
- Install latest NVIDIA drivers
- Verify CUDA 12.6.0 compatibility

**Missing DLL errors:**
- Download missing files from CUDA Toolkit
- Ensure files are not blocked (right-click > Properties > Unblock)

---

For more information, see the main [README](../README.md).
