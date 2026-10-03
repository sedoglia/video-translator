# Whisper.cpp CUDA Binaries

This directory contains the Whisper.cpp binaries with CUDA support for GPU acceleration (release **v1.9.2**, CUDA 12.4).

## ⭐ Automatic Installation (Recommended)

**The easiest way to get all required binaries:**

```bash
npm run setup
```

This single command will automatically:
- ✅ Check for missing (or outdated) binaries
- ✅ Download the official Whisper.cpp v1.9.2 CUDA release (~640 MB)
- ✅ Install only the files the app needs into this directory
- ✅ Download the Whisper AI model
- ✅ Verify installation

Binaries from older Whisper.cpp releases (with `main.exe`) are detected and replaced.

**No manual steps required!** Everything is handled automatically.

---

## Manual Installation (Alternative)

Due to GitHub's file size limitations (100 MB max), the binaries are not included in this repository.

### Files needed:

- `whisper-cli.exe` - Whisper.cpp command-line program
- `whisper.dll`, `ggml.dll`, `ggml-base.dll` - Whisper.cpp / ggml libraries
- `ggml-cuda.dll` - CUDA backend (~512 MB)
- `ggml-cpu-*.dll` - CPU backends (one is picked at runtime for your processor)
- `cublas64_12.dll`, `cublasLt64_12.dll`, `cudart64_12.dll` - CUDA 12 runtime libraries

### Download:

1. Download `whisper-cublas-12.4.0-bin-x64.zip` from the [Whisper.cpp v1.9.2 release](https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.2)
2. Open the `Release` folder inside the archive
3. Copy the files listed above into this directory (`whisper-bin/`)

Since Whisper.cpp 1.7, `main.exe` is only a stub that prints a deprecation warning: use `whisper-cli.exe`.

## Whisper Models

AI models are downloaded automatically by the setup script:
```bash
npm run setup          # Downloads medium model (recommended)
npm run setup:tiny     # Fastest, smaller model
npm run setup:large    # Highest quality, larger model
```

Models are stored in `whisper-bin/models/` and cached after first download.

## Verification

After placing the files, run the application to verify:
- The app will show "✓ CUDA GPU detected" if properly configured
- Check GPU usage in Task Manager during transcription

## GPU Requirements

- NVIDIA GPU with CUDA Compute Capability 5.0+ (GeForce GTX 900 series or newer)
- NVIDIA Driver 551.61 or newer (CUDA 12.4)
- Windows 10/11 64-bit

Without a compatible NVIDIA GPU, Whisper.cpp runs on the CPU (much slower).

## Troubleshooting

**GPU not detected:**
- Ensure all files listed above are in the `whisper-bin/` directory
- Update the NVIDIA driver to 551.61 or newer

**Missing DLL errors:**
- Run `npm run setup` again to reinstall the binaries
- Ensure files are not blocked (right-click > Properties > Unblock)

---

For more information, see the main [README](../README.md).
