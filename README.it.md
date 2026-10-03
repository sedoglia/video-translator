# Video Audio Translator

Un'applicazione desktop per tradurre l'audio dei video utilizzando riconoscimento vocale AI, traduzione e sintesi vocale.

[🇬🇧 English Version](README.md) | [📋 Informativa Privacy](PRIVACY.it.md)

## Caratteristiche

- 🎥 **Supporto Video YouTube** - Scarica ed elabora video direttamente da YouTube
- 🎙️ **Riconoscimento Vocale AI** - Alimentato da Whisper.cpp con accelerazione GPU CUDA
- 🌍 **Traduzione Automatica** - Traduci l'audio in più lingue usando Google Translate
- 🗣️ **Sintesi Vocale Neurale** - Voce naturale con Microsoft Edge TTS
- ⚡ **Accelerazione GPU** - Supporto CUDA per trascrizioni più veloci (GPU NVIDIA)
- 🎯 **Lip-Sync ULTRA-PRECISO** - Precisione 95%+ con controllo adattivo velocità TTS, cross-fade e padding dinamico
- 🎬 **Elaborazione Video** - Sincronizzazione automatica audio/video mantenendo qualità originale

## Interfaccia Utente

![Interfaccia Applicazione](screenshots/interface.png)

L'applicazione presenta un'interfaccia intuitiva con:
- Selezione sorgente video (File Locale o URL YouTube)
- Configurazione lingue (lingua sorgente e destinazione)
- Toggle accelerazione GPU CUDA con rilevamento automatico
- Selezione directory output
- Monitoraggio progresso in tempo reale
- Log dettagliati dell'elaborazione

## Requisiti

### Requisiti di Sistema
- **Sistema Operativo**: Windows 10/11 (64-bit)
- **RAM**: 4GB minimo, 8GB consigliati
- **Spazio su Disco**: 2GB di spazio libero per i modelli e l'elaborazione
- **GPU** (opzionale): GPU NVIDIA con supporto CUDA 12.6.0 per trascrizioni più veloci

### Requisiti Software
- **Node.js**: v22.12 o superiore
- **FFmpeg**: Richiesto per l'elaborazione video
- **Visual C++ Redistributable**: 2015-2022 (solitamente pre-installato su Windows)

## Installazione

### 1. Installare Node.js
Scarica e installa Node.js da [nodejs.org](https://nodejs.org/)

### 2. Installare FFmpeg
Scarica FFmpeg da [ffmpeg.org](https://ffmpeg.org/download.html) e aggiungilo al PATH di sistema.

Per verificare l'installazione, esegui:
```bash
ffmpeg -version
```

### 3. Clonare il Repository
```bash
git clone https://github.com/yourusername/video-translator.git
cd video-translator
```

### 4. Installare le Dipendenze
```bash
npm install
```

### 5. Scaricare Modello Whisper e Binari CUDA (Setup Automatico)

**Metodo Facile - Setup Completamente Automatico:**
```bash
# Scarica binari CUDA + modello medium consigliato automaticamente
npm run setup

# Oppure scarica binari CUDA + modello specifico
npm run setup:tiny     # Più veloce (75 MB)
npm run setup:base     # Veloce (142 MB)
npm run setup:small    # Bilanciato (466 MB)
npm run setup:medium   # Migliore qualità (1.5 GB) - Consigliato
npm run setup:large    # Qualità massima (3.1 GB)
```

Lo script di setup eseguirà automaticamente:
1. **Verifica binari CUDA** (whisper.dll e DLL CUDA)
2. **Scarica binari mancanti** dai rilasci ufficiali Whisper.cpp (~15 MB)
3. **Estrae e installa** nella directory `whisper-bin/`
4. **Scarica il modello AI Whisper selezionato**
5. **Verifica supporto GPU** e installazione
6. **Mostra progresso** durante tutti i download

**Nessun intervento manuale richiesto!** Lo script gestisce tutto.

**Metodo Manuale (Alternativo):**
```bash
# Visita: https://huggingface.co/ggerganov/whisper.cpp/tree/main
# Scarica: ggml-medium.bin
# Posizionalo in: whisper-bin/models/ggml-medium.bin
```

**Alternativa PowerShell per Windows:**
```powershell
# Esegui lo script PowerShell di setup
.\scripts\setup-whisper.ps1 -Model medium
```

### 6. Supporto GPU (Opzionale)
Se hai una GPU NVIDIA con supporto CUDA, l'applicazione la userà automaticamente per trascrizioni più veloci. Lo script di setup (`npm run setup`) scarica e installa automaticamente i binari Whisper.cpp con CUDA richiesti.

Per verificare il supporto GPU:
- Lo script di setup mostrerà "✓ NVIDIA GPU detected!" durante l'installazione
- L'applicazione mostrerà "✓ CUDA GPU rilevata" nell'interfaccia
- Controlla l'utilizzo GPU durante la trascrizione usando Task Manager

**Requisiti per accelerazione GPU:**
- GPU NVIDIA con CUDA Compute Capability 3.0+
- Driver NVIDIA 522.06 o più recente
- Windows 10/11 64-bit

## Utilizzo

### Avviare l'Applicazione

#### Modalità Sviluppo
```bash
npm start
```

#### Build per Produzione
```bash
npm run build
npm run electron
```

### Elaborare un Video

1. **Seleziona Sorgente Video**
   - Scegli "YouTube URL" e incolla un link YouTube, OPPURE
   - Scegli "File Locale" e sfoglia per selezionare un file video

2. **Configura Impostazioni**
   - **Lingua Sorgente**: Seleziona la lingua audio originale o usa "Rilevamento Automatico"
   - **Lingua Destinazione**: Seleziona la lingua in cui tradurre
   - **Usa GPU CUDA**: Abilita per elaborazione più veloce (se hai una GPU NVIDIA)
   - **Directory Output**: Scegli dove salvare il video tradotto

3. **Avvia Elaborazione**
   - Clicca "Avvia Elaborazione"
   - Monitora il progresso in tempo reale
   - Il processo include:
     - Download video (se YouTube)
     - Estrazione audio
     - Riconoscimento vocale (Whisper.cpp)
     - Traduzione (Google Translate)
     - Sintesi vocale (Microsoft Edge TTS)
     - Remux video con nuovo audio

4. **Output**
   - Il video tradotto sarà salvato nella directory output
   - Formato nome file: `video_translated_to_{lingua}.mp4`

### Analisi dei Risultati

Dopo aver elaborato un video, puoi analizzare l'accuratezza e le metriche di prestazione usando lo script di analisi incluso:

```bash
node analyze-results.js
```

Questo script:
- Trova automaticamente il file di log più recente
- Estrae le metriche di calibrazione (campioni, rapporto durata, rate calcolato)
- Mostra la percentuale di accuratezza e la strategia lip-sync utilizzata
- Mostra le metriche di durata (durata originale vs finale, differenza)
- Fornisce un chiaro indicatore successo/fallimento basato sulle soglie di accuratezza:
  - ✅ **SUCCESSO**: Accuratezza ≥ 95%
  - ⚠️ **VICINO**: Accuratezza ≥ 90% ma < 95%
  - ❌ **DA MIGLIORARE**: Accuratezza < 90%

**Esempio output:**
```
=== Analisi Ultimi Risultati Test ===

📊 Fase Calibrazione:
  Campioni: 10
  Target Medio: 6.16s
  Attuale Medio: 3.07s
  Rapporto Durata: 0.499
  Rate Calcolato: -50%

📈 Risultati:
  Strategia: 1:1 perfect match
  Segmenti: 88
  Rate Calibrazione: -50%

⏱️  Durata:
  Originale: 441.72s
  Finale: 454.02s
  Differenza: 12.30s

🎯 Accuratezza: 97.22%

✅ SUCCESSO - Accuratezza >= 95%
```

**Strategie Controllo Rate Adattivo:**
- **Rate GLOBALE**: Usato quando la varianza è bassa (stdDev < 0.3) - applica un singolo rate all'intero video
- **Rate PER-SEGMENTO**: Usato quando la varianza è alta (stdDev ≥ 0.3) - calcola un rate unico per ogni segmento basato sulla calibrazione

## Lingue Supportate

L'applicazione supporta tutte le lingue disponibili in Google Translate, incluse:

- Inglese (en)
- Italiano (it)
- Spagnolo (es)
- Francese (fr)
- Tedesco (de)
- Portoghese (pt)
- Russo (ru)
- Giapponese (ja)
- Cinese (zh-CN, zh-TW)
- Arabo (ar)
- E molte altre...

## Struttura del Progetto

```
video-translator/
├── src/
│   ├── main.ts              # Processo principale Electron
│   ├── preload.ts           # Script preload Electron
│   ├── backend/             # Servizi backend
│   │   ├── server.ts        # Server Express + Socket.IO
│   │   ├── services/        # Servizi core
│   │   │   ├── WhisperService.ts      # Riconoscimento vocale
│   │   │   ├── TranslationService.ts  # Traduzione
│   │   │   ├── TTSService.ts          # Text-to-speech
│   │   │   ├── VideoRemux.ts          # Elaborazione video
│   │   │   └── VideoProcessor.ts      # Orchestratore principale
│   │   └── controllers/     # Controller API
│   ├── renderer/            # Frontend React
│   │   ├── App.tsx          # Componente principale app
│   │   ├── components/      # Componenti UI
│   │   └── hooks/           # Hook React
│   └── shared/              # Tipi condivisi
├── whisper-bin/             # Binari Whisper.cpp
│   └── models/              # Modelli Whisper
├── temp/                    # File temporanei elaborazione
└── output/                  # Directory output predefinita
```

## Come Funziona

### Panoramica del Processo

```
┌─────────────────────────────────────────────────────────────────────┐
│                   PIPELINE TRADUZIONE VIDEO                         │
└─────────────────────────────────────────────────────────────────────┘

INPUT: File Video o URL YouTube
   │
   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. ACQUISIZIONE VIDEO                                               │
│    • YouTube: yt-dlp scarica il video                               │
│    • Locale: Valida il formato file                                 │
└─────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. ESTRAZIONE AUDIO                                                 │
│    • FFmpeg estrae la traccia audio                                 │
│    • Converte in WAV mono 16kHz                                     │
│    • Ottimizzato per input Whisper.cpp                              │
└─────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. RICONOSCIMENTO VOCALE (Whisper.cpp + CUDA)                       │
│    • Carica modello GGML (tiny/base/small/medium/large)             │
│    • Accelerazione GPU via CUDA 12.6.0 (se disponibile)             │
│    • Estrae testo con timestamp a livello di parola                 │
│    • Rileva automaticamente la lingua sorgente                      │
│    Output: Testo trascritto nella lingua originale                  │
└─────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. TRADUZIONE (Google Translate API)                                │
│    • Singola chiamata API per l'intero testo                        │
│    • Preserva la struttura del testo                                │
│    • Retry automatico con exponential backoff                       │
│    Output: Testo tradotto nella lingua destinazione                 │
└─────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌────────────────────────────────────────────────────────────────────┐
│ 5. SINTESI TEXT-TO-SPEECH (Microsoft Edge TTS)                     │
│    ┌─────────────────────────────────────────────────────────────┐ │
│    │ a) Allineamento Timestamp a Livello di Parola               │ │
│    │    • Usa timestamp parola/frase di Whisper                  │ │
│    │    • Segmentazione intelligente su confini frasi            │ │
│    │    • Preserva il ritmo naturale del parlato                 │ │
│    └─────────────────────────────────────────────────────────────┘ │
│    ┌─────────────────────────────────────────────────────────────┐ │
│    │ b) Controllo Rate TTS Adattivo                              │ │
│    │    • Fase calibrazione: 15 segmenti o 20% del video         │ │
│    │    • Rilevamento varianza (soglia stdDev: 0.3)              │ │
│    │    • Rate GLOBALE: Singolo rate per parlato consistente     │ │
│    │    • Rate PER-SEGMENTO: Rate individuali per parlato vario  │ │
│    │    • Range rate Edge TTS: -100% a +100% (qualità massima)   │ │
│    │    • Predizione pesata basata su campioni calibrazione      │ │
│    └─────────────────────────────────────────────────────────────┘ │
│    ┌─────────────────────────────────────────────────────────────┐ │
│    │ c) Sintesi Voce Neurale                                     │ │
│    │    • TTS neurale basato su cloud per ogni segmento          │ │
│    │    • Selezione voce appropriata per la lingua               │ │
│    │    • Output ad alta qualità 24kHz                           │ │
│    │    • Sintesi controllata da rate per matching durata        │ │
│    └─────────────────────────────────────────────────────────────┘ │
│    ┌─────────────────────────────────────────────────────────────┐ │
│    │ d) Inserimento Silenzi ULTRA-PRECISO & Lip-Sync             │ │
│    │    • Inserisce silenzio esatto prima/dopo ogni segmento     │ │
│    │    • Time-stretch segmenti per matchare timestamp Whisper   │ │
│    │    • Cross-fade triangolare 10ms tra segmenti               │ │
│    │    • Padding dinamico (2-8ms) basato su speech rate         │ │
│    │    • Preserva pause originali tra parole (±20ms)            │ │
│    │    • Soglia ultra-precisa: precisione 1ms                   │ │
│    │    • Micro-aggiustamento finale per sync perfetto (±1%)     │ │
│    │    • Accuratezza: sincronizzazione 95%+                     │ │
│    └─────────────────────────────────────────────────────────────┘ │
│    Output: Audio ultra-sincronizzato nella lingua destinazione     │
└────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. REMUX VIDEO (FFmpeg)                                             │
│    • Sostituisce audio originale con audio tradotto                 │
│    • Stream video: copia (no re-encoding, preserva qualità)         │
│    • Stream audio: codec AAC, timing sincronizzato                  │
│    • Formato output: container MP4                                  │
└─────────────────────────────────────────────────────────────────────┘
   │
   ▼
OUTPUT: Video Tradotto (video_translated_to_{lingua}.mp4)
```

### Passaggi Dettagliati del Processo

1. **Download/Validazione Video**
   - Scarica il video da YouTube usando yt-dlp
   - Oppure valida il file video locale

2. **Estrazione Audio**
   - Estrae la traccia audio dal video usando FFmpeg
   - Converte in formato WAV 16kHz per Whisper

3. **Riconoscimento Vocale**
   - Elabora l'audio con Whisper.cpp (modello medium)
   - Estrae il testo con timestamp
   - Rileva automaticamente la lingua se non specificata

4. **Traduzione**
   - Traduce il testo estratto usando Google Translate API
   - Singola chiamata API per evitare rate limiting
   - Retry automatico con exponential backoff

5. **Text-to-Speech con Controllo Rate Adattivo & Lip-Sync ULTRA-PRECISO**
   - **Controllo Rate TTS Adattivo** (NUOVO):
     - Fase calibrazione analizza i primi 15 segmenti (20% del video)
     - Sistema dual-strategy basato sulla varianza del parlato:
       - **Rate GLOBALE**: Singolo aggiustamento rate per pattern di parlato consistente (stdDev < 0.3)
       - **Rate PER-SEGMENTO**: Rate individuale per segmento per parlato variabile (stdDev ≥ 0.3)
     - Predizione intelligente durata usando campioni calibrazione pesati
     - Controllo rate Edge TTS: -100% a +100% per aggiustamento naturale
   - Genera voce dal testo tradotto usando voci neurali Microsoft Edge TTS
   - Traduzione a livello di frase che preserva contesto e significato
   - Codifica UTF-8 corretta che preserva caratteri accentati (à,è,ì,ò,ù,é,á)
   - Allineamento timestamp a livello di parola usando i timing precisi di Whisper
   - Inserimento automatico silenzi per preservare le pause originali (precisione ±20ms)
   - Cross-fade triangolare 10ms tra segmenti per transizioni fluide
   - Padding dinamico (2-8ms) regolato in base all'analisi del ritmo vocale
   - Time-stretch individuale per segmento per matchare esattamente le durate timestamp (precisione 1ms)
   - Micro-aggiustamento finale per sincronizzazione perfetta (tolleranza ±1%)
   - Risultato: precisione sincronizzazione labiale 95%+
   - Output ad alta qualità 24kHz

6. **Remux Video**
   - Combina video originale con audio tradotto
   - Mantiene la qualità video (copia codec)
   - Sincronizza timing audio/video

## Risoluzione Problemi

### GPU Non Rilevata
- Assicurati di avere una GPU NVIDIA con supporto CUDA
- Installa i driver NVIDIA più recenti
- È richiesto il supporto CUDA 12.6.0

### Traduzione Fallisce
- Controlla la connessione internet
- Se ricevi "Too Many Requests", aspetta qualche minuto
- L'app ha retry automatico con exponential backoff

### Errori FFmpeg
- Verifica che FFmpeg sia installato e nel PATH
- Esegui `ffmpeg -version` per controllare
- Su Windows, riavvia il terminale dopo aver aggiunto al PATH

### Elaborazione Lenta
- Abilita GPU CUDA per trascrizioni più veloci (10-20x più veloce)
- Usa video più piccoli per test
- Chiudi altre applicazioni intensive per GPU

### Problemi Voce TTS
- Microsoft Edge TTS usa voci neurali basate su cloud
- Non è richiesta alcuna installazione aggiuntiva
- Richiede connessione internet per la generazione TTS
- Supporta oltre 100 lingue con voci dal suono naturale

## Consigli Prestazioni

1. **Accelerazione GPU**: Abilita CUDA per trascrizioni 10-20x più veloci
2. **Selezione Modello**: Il modello medium offre il miglior bilanciamento velocità/qualità
3. **Elaborazione Batch**: Elabora un video alla volta per risultati migliori
4. **Spazio Disco**: Assicurati di avere spazio libero sufficiente (2x dimensione video + modelli)

## Limitazioni Note

- Il burning dei sottotitoli è attualmente disabilitato (sarà re-implementato in una versione futura)
- Richiede connessione internet per traduzione e generazione TTS
- Rate limiting Google Translate (gestito automaticamente con retry)

## Tecnologie Utilizzate

- **Electron 44.5** - Framework applicazione desktop
- **React 19.3** - Framework UI
- **TypeScript 6.0** - Sviluppo type-safe
- **Express 5.2** - Server backend
- **Socket.IO 4.8** - Comunicazione real-time
- **Whisper.cpp 1.6.2** - Riconoscimento vocale (CUDA 12.6.0)
- **FFmpeg** - Elaborazione video/audio
- **Google Translate API** - Servizio traduzione
- **Microsoft Edge TTS** - Sintesi vocale neurale text-to-speech

## Contribuire

I contributi sono benvenuti! Sentiti libero di inviare una Pull Request.

## Licenza

Questo progetto è rilasciato con licenza MIT - vedi il file LICENSE per i dettagli.

## Ringraziamenti

- [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) - Implementazione veloce di Whisper di OpenAI
- [FFmpeg](https://ffmpeg.org/) - Framework multimedia
- [Google Translate](https://translate.google.com/) - Servizio traduzione
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Downloader YouTube

## Supporto

Per problemi, domande o suggerimenti, apri un issue su GitHub.

## Supporta il Progetto

Se trovi utile questo progetto, considera di supportarne lo sviluppo:

[![Dona con PayPal](https://img.shields.io/badge/Dona-PayPal-blue.svg)](https://paypal.me/sedoglia)

Il tuo supporto aiuta a mantenere e migliorare questo progetto open-source!

## Privacy

Questa applicazione rispetta la tua privacy. Tutta l'elaborazione video avviene localmente sul tuo dispositivo. Solo il testo (trascrizioni e traduzioni) è inviato a API di terze parti. Leggi la nostra [Informativa Privacy](PRIVACY.it.md) completa per dettagli sulla conformità GDPR e gestione dei dati.

---

Realizzato con ❤️ usando Electron, React e AI
