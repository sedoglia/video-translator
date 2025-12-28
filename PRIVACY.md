# Privacy Policy

**Last Updated: December 28, 2025**

## Introduction

Video Audio Translator ("the Application") is committed to protecting your privacy. This Privacy Policy explains how we handle your data when you use our desktop application.

## GDPR Compliance

This Application is designed with privacy by design and complies with the General Data Protection Regulation (GDPR) EU 2016/679. We respect your rights regarding personal data protection.

## Data Controller

The data controller for this Application is the end user who installs and operates the software on their own device.

## What Data We Collect

### Data Processed Locally

The Application processes the following data **entirely on your local device**:

1. **Video Files**
   - Videos you select for translation (local files or YouTube URLs)
   - Extracted audio tracks
   - Generated translated audio
   - Final translated video output

2. **Processing Data**
   - Transcribed text from speech recognition
   - Translated text
   - Temporary files created during processing

3. **Configuration Data**
   - Application settings (language preferences, output directory, GPU settings)
   - File paths you select

**Important: All video and audio processing happens locally on your device. We do not collect, store, or transmit your video files to any server.**

### Data Sent to Third-Party Services

The Application uses the following external services that may process your data:

1. **Google Translate API**
   - **Data Sent**: Transcribed text from your videos
   - **Purpose**: Translation from source to target language
   - **Privacy Policy**: [Google Privacy Policy](https://policies.google.com/privacy)
   - **Legal Basis**: Legitimate interest for providing translation functionality

2. **Microsoft Edge TTS**
   - **Data Sent**: Translated text
   - **Purpose**: Neural text-to-speech synthesis
   - **Privacy Policy**: [Microsoft Privacy Policy](https://privacy.microsoft.com/privacystatement)
   - **Legal Basis**: Legitimate interest for providing TTS functionality

3. **YouTube (yt-dlp)**
   - **Data Sent**: Video URL (only if you choose to download from YouTube)
   - **Purpose**: Download video for local processing
   - **Privacy Policy**: [YouTube Privacy Policy](https://policies.google.com/privacy)
   - **Legal Basis**: Your explicit action when providing a YouTube URL

4. **Hugging Face (Model Downloads)**
   - **Data Sent**: HTTP requests to download Whisper AI models
   - **Purpose**: One-time download of speech recognition models
   - **Privacy Policy**: [Hugging Face Privacy Policy](https://huggingface.co/privacy)
   - **Legal Basis**: Necessary for application functionality

## Data Storage and Retention

### Local Storage

- All processed videos, audio files, and temporary files are stored **only on your local device**
- Files are stored in directories you specify (default: `C:\TEMP`)
- Temporary processing files are stored in the `temp/` directory within the application folder
- You have full control over when to delete these files

### No Remote Storage

- **We do not store any of your data on remote servers**
- **We do not have access to your videos, audio, or text**
- **We do not create user accounts or profiles**

## Data Sharing

We do not share your personal data with any third parties except:

1. **Third-party API Services** (as described above) - only the minimal data necessary for their function:
   - Google Translate: text transcription only
   - Microsoft Edge TTS: translated text only
   - YouTube: video URL only (when you provide it)

2. **No Marketing or Analytics**: We do not share data for marketing, advertising, or analytics purposes

## Your Rights Under GDPR

As a data subject under GDPR, you have the following rights:

### 1. Right to Access (Article 15)
You have full access to all data processed by the Application as it resides on your local device.

### 2. Right to Rectification (Article 16)
You can modify or correct any data by editing the files on your device.

### 3. Right to Erasure (Article 17)
You can delete all data by:
- Deleting output files from your chosen directory
- Deleting temporary files from the `temp/` folder
- Uninstalling the Application

### 4. Right to Data Portability (Article 20)
All data is in standard formats (MP4, WAV, MP3, TXT) and can be easily transferred.

### 5. Right to Object (Article 21)
You can stop processing at any time by closing the Application or canceling operations.

### 6. Right to Restriction of Processing (Article 18)
You control when and what to process by choosing which videos to translate.

## Data Security

We implement appropriate technical and organizational measures to protect your data:

1. **Local Processing**: All sensitive processing happens on your device
2. **Encrypted Connections**: Communications with third-party APIs use HTTPS/TLS encryption
3. **No Authentication**: No passwords or credentials are stored (except optional API keys in local configuration)
4. **Minimal Data Transfer**: Only necessary text is sent to translation and TTS services
5. **Temporary File Cleanup**: Temporary files can be manually deleted at any time

## Children's Privacy

This Application does not knowingly collect data from children under 16. If you are under 16, please obtain parental consent before using the Application.

## Third-Party Services and Their Data Processing

### Google Translate
- Processes transcribed text for translation
- Subject to Google's privacy policy and terms of service
- Data may be processed in Google's servers worldwide
- No video or audio data is sent to Google

### Microsoft Edge TTS
- Processes translated text for speech synthesis
- Subject to Microsoft's privacy policy and terms of service
- Data may be processed in Microsoft's servers worldwide
- No video data is sent to Microsoft

### YouTube/yt-dlp
- Only used if you explicitly provide a YouTube URL
- Downloads video to your local device
- Subject to YouTube's privacy policy and terms of service

## Data Processing Activities Record

In compliance with Article 30 GDPR, here's a summary of processing activities:

| Activity | Data | Purpose | Legal Basis | Retention |
|----------|------|---------|-------------|-----------|
| Video Processing | Video files, audio tracks | Translation service | User's explicit action | User-controlled local storage |
| Speech Recognition | Audio data | Text extraction | Legitimate interest | Temporary (processing only) |
| Translation | Transcribed text | Language translation | Legitimate interest | Temporary (API call only) |
| TTS Synthesis | Translated text | Audio generation | Legitimate interest | Temporary (API call only) |
| Configuration | Settings, paths | Application function | Legitimate interest | Until app uninstall |

## Cookies and Tracking

**This Application does not use cookies, analytics, or tracking technologies.**

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. Changes will be reflected in the "Last Updated" date above. We recommend reviewing this policy periodically.

## Open Source Transparency

This Application is open source. You can review the source code to verify our privacy practices:
- Repository: [GitHub Repository URL]
- The code shows exactly what data is processed and how

## Contact Information

For privacy-related questions or to exercise your GDPR rights:

- **Email**: sedoglia@gmail.com
- **GitHub Issues**: [\[URL Issues Repository\]](https://github.com/sedoglia/video-translator/issues)

For issues with third-party services:
- Google Translate: [Google Privacy Policy](https://policies.google.com/privacy)
- Microsoft Edge TTS: [Microsoft Privacy Policy](https://privacy.microsoft.com/privacystatement)
- YouTube: [YouTube Privacy Policy](https://policies.google.com/privacy)

## Legal Basis Summary

Our data processing is based on:

1. **Legitimate Interest** (Article 6(1)(f) GDPR):
   - Providing video translation functionality
   - Using third-party APIs for translation and TTS

2. **User's Explicit Action**:
   - You choose which videos to process
   - You provide YouTube URLs voluntarily
   - You select target languages and settings

3. **Necessary for Service Performance**:
   - Processing cannot occur without using the specified third-party services

## Data Protection Principles

We adhere to GDPR principles:

- ✅ **Lawfulness, Fairness, Transparency**: We clearly explain data processing
- ✅ **Purpose Limitation**: Data used only for video translation
- ✅ **Data Minimization**: Only necessary data is processed
- ✅ **Accuracy**: You control source data accuracy
- ✅ **Storage Limitation**: Data stored only as long as you choose
- ✅ **Integrity and Confidentiality**: Encryption and local processing
- ✅ **Accountability**: This policy demonstrates compliance

## Supervisory Authority

If you have concerns about data protection, you can contact your national data protection authority:
- EU residents: [Your national DPA](https://edpb.europa.eu/about-edpb/board/members_en)
- The application developer is not required to appoint a Data Protection Officer (DPO) under Article 37 GDPR

---

**Summary**: This Application processes your videos locally on your device. Only text (transcriptions and translations) is sent to third-party APIs (Google Translate, Microsoft Edge TTS) for processing. We do not collect, store, or have access to your data. You have full control over your data at all times.
