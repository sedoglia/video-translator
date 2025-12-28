# Getting Started with Video Audio Translator

Welcome! This guide will help you set up and run the application.

## Prerequisites

Before you begin, install:

1. **Node.js 18+**
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify: `node --version`

2. **FFmpeg**
   - **Windows**: `choco install ffmpeg` or [download manually](https://ffmpeg.org/download.html)
   - **macOS**: `brew install ffmpeg`
   - **Linux**: `sudo apt-get install ffmpeg`
   - Verify: `ffmpeg -version`

## Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/sedoglia/video-translator.git
cd video-translator
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required Node.js packages.

### Step 3: Download CUDA Binaries and Whisper Model

Run the automatic setup to download everything needed:

```bash
npm run setup
```

This single command will:
1. **Check for CUDA binaries** and download if missing (~15 MB)
2. **Download Whisper AI model** (default: medium, ~1.5 GB)
3. **Verify GPU support** and installation
4. **Extract and install** everything automatically

**First Run Only**: This downloads large files but only happens once. Everything is cached for future use.

**Alternative models:**
```bash
npm run setup:tiny    # Faster, smaller (75 MB)
npm run setup:small   # Balanced (466 MB)
npm run setup:large   # Best quality (3.1 GB)
```

### Step 4: Configure (Optional)

Copy `.env.example` to `.env` if you want to customize settings:

```bash
cp .env.example .env
```

Default values work fine for most users.

## Running the Application

### Development Mode

```bash
npm run dev
```

This will:
1. Build the TypeScript code
2. Start the backend server
3. Launch the Electron application

### Production Build

```bash
npm run build
npm run electron:build
```

## First Use

1. **Open the Application**
   - Window opens automatically after `npm run dev`

2. **Select a Video**
   - Choose "Local File" and browse, or
   - Choose "YouTube URL" and paste a link
   - Start with a short video (10-30 seconds) for testing

3. **Configure Languages**
   - Source: "Auto Detect" (recommended)
   - Target: Any language you want

4. **Process**
   - Click "Process Video"
   - Watch real-time progress
   - Check logs for details

5. **Get Results**
   - Click "Open Output Folder" when complete
   - Play your translated video!

## Configuration Options

Edit `.env` to customize:

```env
# Server port (default: 3001)
BACKEND_PORT=3001

# Whisper model size (tiny/base/small)
WHISPER_MODEL_NAME=Xenova/whisper-tiny

# Output directory
OUTPUT_DIR=./output
```

### Whisper Models

| Model | Download Size | Speed | Quality |
|-------|--------------|-------|---------|
| whisper-tiny | 70MB | Very Fast | Good |
| whisper-base | 140MB | Fast | Better |
| whisper-small | 500MB | Medium | Best |

Default is `whisper-tiny` - good balance of speed and quality.

## Troubleshooting

### FFmpeg Not Found
```bash
# Check if installed
ffmpeg -version

# If not, install for your OS (see Prerequisites above)
```

### Port Already in Use
Edit `.env` and change port:
```env
BACKEND_PORT=3002
```

### Slow Model Download
- First run downloads ~70-200MB
- Requires good internet connection
- Only happens once (models are cached)

### TTS Not Working
- TTS uses Microsoft Edge TTS cloud-based neural voices
- No additional installation required
- Requires internet connection for TTS generation
- Supports 100+ languages with natural-sounding voices

## Next Steps

- Read the [README](README.md) for full documentation
- Check [CONTRIBUTING](CONTRIBUTING.md) to contribute
- Try different languages and models
- Process your own videos!

## Getting Help

- Check application logs for errors
- Review troubleshooting section above
- Open an issue on GitHub with details

---

Happy translating! 🎥🌍🎤
