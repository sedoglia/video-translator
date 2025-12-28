# Informativa sulla Privacy

**Ultimo Aggiornamento: 28 Dicembre 2024**

## Introduzione

Video Audio Translator ("l'Applicazione") si impegna a proteggere la tua privacy. Questa Informativa sulla Privacy spiega come gestiamo i tuoi dati quando utilizzi la nostra applicazione desktop.

## Conformità al GDPR

Questa Applicazione è progettata con privacy by design ed è conforme al Regolamento Generale sulla Protezione dei Dati (GDPR) UE 2016/679. Rispettiamo i tuoi diritti relativi alla protezione dei dati personali.

## Titolare del Trattamento

Il titolare del trattamento per questa Applicazione è l'utente finale che installa e utilizza il software sul proprio dispositivo.

## Quali Dati Raccogliamo

### Dati Elaborati Localmente

L'Applicazione elabora i seguenti dati **interamente sul tuo dispositivo locale**:

1. **File Video**
   - Video che selezioni per la traduzione (file locali o URL YouTube)
   - Tracce audio estratte
   - Audio tradotto generato
   - Video tradotto finale in output

2. **Dati di Elaborazione**
   - Testo trascritto dal riconoscimento vocale
   - Testo tradotto
   - File temporanei creati durante l'elaborazione

3. **Dati di Configurazione**
   - Impostazioni applicazione (preferenze lingua, directory output, impostazioni GPU)
   - Percorsi file che selezioni

**Importante: Tutta l'elaborazione di video e audio avviene localmente sul tuo dispositivo. Non raccogliamo, archiviamo o trasmettiamo i tuoi file video a nessun server.**

### Dati Inviati a Servizi di Terze Parti

L'Applicazione utilizza i seguenti servizi esterni che possono elaborare i tuoi dati:

1. **Google Translate API**
   - **Dati Inviati**: Testo trascritto dai tuoi video
   - **Scopo**: Traduzione dalla lingua sorgente alla lingua destinazione
   - **Informativa Privacy**: [Google Privacy Policy](https://policies.google.com/privacy)
   - **Base Giuridica**: Legittimo interesse per fornire la funzionalità di traduzione

2. **Microsoft Edge TTS**
   - **Dati Inviati**: Testo tradotto
   - **Scopo**: Sintesi vocale neurale text-to-speech
   - **Informativa Privacy**: [Microsoft Privacy Policy](https://privacy.microsoft.com/privacystatement)
   - **Base Giuridica**: Legittimo interesse per fornire la funzionalità TTS

3. **YouTube (yt-dlp)**
   - **Dati Inviati**: URL video (solo se scegli di scaricare da YouTube)
   - **Scopo**: Download video per elaborazione locale
   - **Informativa Privacy**: [YouTube Privacy Policy](https://policies.google.com/privacy)
   - **Base Giuridica**: Tua azione esplicita quando fornisci un URL YouTube

4. **Hugging Face (Download Modelli)**
   - **Dati Inviati**: Richieste HTTP per scaricare modelli AI Whisper
   - **Scopo**: Download una tantum dei modelli di riconoscimento vocale
   - **Informativa Privacy**: [Hugging Face Privacy Policy](https://huggingface.co/privacy)
   - **Base Giuridica**: Necessario per la funzionalità dell'applicazione

## Archiviazione e Conservazione dei Dati

### Archiviazione Locale

- Tutti i video elaborati, file audio e file temporanei sono archiviati **solo sul tuo dispositivo locale**
- I file sono archiviati nelle directory che specifichi (default: `C:\TEMP`)
- I file temporanei di elaborazione sono archiviati nella directory `temp/` all'interno della cartella applicazione
- Hai il pieno controllo su quando eliminare questi file

### Nessuna Archiviazione Remota

- **Non archiviamo nessuno dei tuoi dati su server remoti**
- **Non abbiamo accesso ai tuoi video, audio o testo**
- **Non creiamo account utente o profili**

## Condivisione dei Dati

Non condividiamo i tuoi dati personali con terze parti eccetto:

1. **Servizi API di Terze Parti** (come descritto sopra) - solo i dati minimi necessari per la loro funzione:
   - Google Translate: solo trascrizione testuale
   - Microsoft Edge TTS: solo testo tradotto
   - YouTube: solo URL video (quando lo fornisci)

2. **Nessun Marketing o Analytics**: Non condividiamo dati per scopi di marketing, pubblicità o analytics

## I Tuoi Diritti Secondo il GDPR

Come interessato secondo il GDPR, hai i seguenti diritti:

### 1. Diritto di Accesso (Articolo 15)
Hai pieno accesso a tutti i dati elaborati dall'Applicazione in quanto risiedono sul tuo dispositivo locale.

### 2. Diritto di Rettifica (Articolo 16)
Puoi modificare o correggere qualsiasi dato modificando i file sul tuo dispositivo.

### 3. Diritto alla Cancellazione (Articolo 17)
Puoi eliminare tutti i dati:
- Eliminando i file di output dalla directory scelta
- Eliminando i file temporanei dalla cartella `temp/`
- Disinstallando l'Applicazione

### 4. Diritto alla Portabilità dei Dati (Articolo 20)
Tutti i dati sono in formati standard (MP4, WAV, MP3, TXT) e possono essere facilmente trasferiti.

### 5. Diritto di Opposizione (Articolo 21)
Puoi interrompere l'elaborazione in qualsiasi momento chiudendo l'Applicazione o annullando le operazioni.

### 6. Diritto di Limitazione del Trattamento (Articolo 18)
Controlli quando e cosa elaborare scegliendo quali video tradurre.

## Sicurezza dei Dati

Implementiamo misure tecniche e organizzative appropriate per proteggere i tuoi dati:

1. **Elaborazione Locale**: Tutta l'elaborazione sensibile avviene sul tuo dispositivo
2. **Connessioni Cifrate**: Le comunicazioni con API di terze parti usano crittografia HTTPS/TLS
3. **Nessuna Autenticazione**: Nessuna password o credenziale è archiviata (eccetto chiavi API opzionali nella configurazione locale)
4. **Trasferimento Dati Minimo**: Solo il testo necessario è inviato ai servizi di traduzione e TTS
5. **Pulizia File Temporanei**: I file temporanei possono essere eliminati manualmente in qualsiasi momento

## Privacy dei Minori

Questa Applicazione non raccoglie consapevolmente dati da minori di 16 anni. Se hai meno di 16 anni, ottieni il consenso dei genitori prima di utilizzare l'Applicazione.

## Servizi di Terze Parti e il Loro Trattamento dei Dati

### Google Translate
- Elabora il testo trascritto per la traduzione
- Soggetto all'informativa privacy e termini di servizio di Google
- I dati possono essere elaborati nei server Google in tutto il mondo
- Nessun dato video o audio è inviato a Google

### Microsoft Edge TTS
- Elabora il testo tradotto per la sintesi vocale
- Soggetto all'informativa privacy e termini di servizio di Microsoft
- I dati possono essere elaborati nei server Microsoft in tutto il mondo
- Nessun dato video è inviato a Microsoft

### YouTube/yt-dlp
- Utilizzato solo se fornisci esplicitamente un URL YouTube
- Scarica il video sul tuo dispositivo locale
- Soggetto all'informativa privacy e termini di servizio di YouTube

## Registro delle Attività di Trattamento

In conformità con l'Articolo 30 GDPR, ecco un riepilogo delle attività di trattamento:

| Attività | Dati | Scopo | Base Giuridica | Conservazione |
|----------|------|-------|----------------|---------------|
| Elaborazione Video | File video, tracce audio | Servizio traduzione | Azione esplicita utente | Archiviazione locale controllata dall'utente |
| Riconoscimento Vocale | Dati audio | Estrazione testo | Legittimo interesse | Temporanea (solo elaborazione) |
| Traduzione | Testo trascritto | Traduzione linguistica | Legittimo interesse | Temporanea (solo chiamata API) |
| Sintesi TTS | Testo tradotto | Generazione audio | Legittimo interesse | Temporanea (solo chiamata API) |
| Configurazione | Impostazioni, percorsi | Funzione applicazione | Legittimo interesse | Fino a disinstallazione app |

## Cookie e Tracciamento

**Questa Applicazione non utilizza cookie, analytics o tecnologie di tracciamento.**

## Modifiche a Questa Informativa sulla Privacy

Potremmo aggiornare questa Informativa sulla Privacy di tanto in tanto. Le modifiche saranno riflesse nella data "Ultimo Aggiornamento" sopra. Raccomandiamo di rivedere periodicamente questa informativa.

## Trasparenza Open Source

Questa Applicazione è open source. Puoi rivedere il codice sorgente per verificare le nostre pratiche sulla privacy:
- Repository: [URL Repository GitHub]
- Il codice mostra esattamente quali dati sono elaborati e come

## Informazioni di Contatto

Per domande relative alla privacy o per esercitare i tuoi diritti GDPR:

- **Email**: [Tua email di contatto]
- **GitHub Issues**: [URL Issues Repository]

Per problemi con servizi di terze parti:
- Google Translate: [Google Privacy Policy](https://policies.google.com/privacy)
- Microsoft Edge TTS: [Microsoft Privacy Policy](https://privacy.microsoft.com/privacystatement)
- YouTube: [YouTube Privacy Policy](https://policies.google.com/privacy)

## Riepilogo Base Giuridica

Il nostro trattamento dei dati si basa su:

1. **Legittimo Interesse** (Articolo 6(1)(f) GDPR):
   - Fornire la funzionalità di traduzione video
   - Utilizzare API di terze parti per traduzione e TTS

2. **Azione Esplicita dell'Utente**:
   - Tu scegli quali video elaborare
   - Fornisci volontariamente URL YouTube
   - Selezioni lingue destinazione e impostazioni

3. **Necessario per l'Esecuzione del Servizio**:
   - L'elaborazione non può avvenire senza utilizzare i servizi di terze parti specificati

## Principi di Protezione dei Dati

Aderiamo ai principi GDPR:

- ✅ **Liceità, Correttezza, Trasparenza**: Spieghiamo chiaramente il trattamento dei dati
- ✅ **Limitazione della Finalità**: I dati sono usati solo per la traduzione video
- ✅ **Minimizzazione dei Dati**: Solo i dati necessari sono elaborati
- ✅ **Esattezza**: Controlli l'accuratezza dei dati sorgente
- ✅ **Limitazione della Conservazione**: I dati sono conservati solo finché scegli tu
- ✅ **Integrità e Riservatezza**: Crittografia ed elaborazione locale
- ✅ **Responsabilizzazione**: Questa informativa dimostra la conformità

## Autorità di Controllo

Se hai dubbi sulla protezione dei dati, puoi contattare la tua autorità nazionale di protezione dei dati:
- Residenti UE: [La tua DPA nazionale](https://edpb.europa.eu/about-edpb/board/members_en)
- Lo sviluppatore dell'applicazione non è tenuto a nominare un Responsabile della Protezione dei Dati (DPO) secondo l'Articolo 37 GDPR

---

**Riepilogo**: Questa Applicazione elabora i tuoi video localmente sul tuo dispositivo. Solo il testo (trascrizioni e traduzioni) è inviato a API di terze parti (Google Translate, Microsoft Edge TTS) per l'elaborazione. Non raccogliamo, archiviamo o abbiamo accesso ai tuoi dati. Hai il pieno controllo sui tuoi dati in ogni momento.
