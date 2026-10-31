# Classificatore foto: memoria del progetto

Riepilogo completo della chat in cui è nato il progetto (31 ottobre 2026). Serve a riprendere il
lavoro in futuro, anche in una nuova conversazione, senza perdere decisioni e scoperte.

---

## 1. Obiettivo

Riordinare il backup del telefono Android dell'utente, che si trova in **una sola cartella** su un SSD:

```
D:\[02] File Multimediali\[02] Telefono
```

Contiene foto della fotocamera, foto e immagini da **WhatsApp** e **Instagram**, **screenshot**.
Lo scopo è classificarle (screenshot, foto di lavagne, meme, documenti, scarti…) per poi cancellare
ciò che non serve, per esempio le foto della lavagna di 6 anni fa delle superiori.

Requisiti emersi:

- tutto **in locale**, nessuna foto caricata online;
- PC con **Windows 11**;
- usare i modelli di **Desert Ant Labs**;
- un'**app** (anche web app) con la **scelta della cartella** prima di avviare l'analisi;
- non cancellare nulla in automatico: l'utente rivede e decide.

Cartella attuale del progetto sul PC:

```
C:\Users\paulb\Documents\GitHub\Gestione_file\Classificatore foto
```

---

## 2. Desert Ant Labs: cosa abbiamo scoperto

- Startup europea (Paesi Bassi), lanciata l'8 settembre 2026. Fa modelli AI piccoli che girano
  **sul dispositivo** (on-device): audio, testo, visione.
- Sito: <https://desertant.com> · GitHub: <https://github.com/Desert-Ant-Labs> ·
  Hugging Face: <https://huggingface.co/desert-ant-labs>
- SDK per Swift, Kotlin, JavaScript/Node. CLI `desertant` (alias `da`) solo per macOS (Apple
  Silicon) e Linux, **non Windows**. App pronte (Clipper, Redactor, Desert Ant Flow) solo per Mac.
- Licenza dei modelli: **Desert Ant Labs Source-Available License** (non open source in senso
  stretto). Gratis fino a 100.000 dispositivi attivi al mese, quindi gratis per uso personale.
- Affidabilità: azienda molto giovane, codice pubblico e attivo, nessuna recensione indipendente
  seria. Va bene per uso personale; per un prodotto commerciale valutare il rischio.
- **Telemetria**: leggendo il codice dell'SDK risulta che invia statistiche d'uso per la licenza
  (conteggio delle chiamate) a `https://events.desertant.com/api/v1`. Le immagini restano sul PC.

### Il modello Eye

Il modello giusto per questo progetto è **Eye** (classificazione immagini).

- Pagina: <https://desertant.com/models/eye/> · Docs: <https://desertant.com/docs/eye/>
- Pesi: <https://huggingface.co/desert-ant-labs/eye>
- Inizialmente la documentazione diceva "beta chiusa, pesi riservati, serve `HF_TOKEN`". Alla
  verifica dell'utente la pagina Hugging Face **non chiede più l'accesso**: il modello è
  scaricabile liberamente.
- File su Hugging Face:
  - `eye.tflite`: circa 66 MB, LiteRT, per Windows, Linux, Android, Node e browser. **Serve questo.**
  - `eye_meta.json`: circa 281 KB. **Serve anche questo.**
  - `eye.mlmodelc`: 48 MB, Core ML, solo Apple. Non serve.
- Velocità dichiarata: 41 ms a foto con WebGPU in Chrome, 176 ms con WebAssembly multi-thread.
- Precisione dichiarata alla soglia 0.5: screenshot 98%, scontrini 100%, scene 88% mediana.
  Le ragioni "da buttare" (`forgettable`, `bad_framing`…) sono le meno affidabili: usarle come
  suggerimento. Eye è addestrato su foto: su screenshot e illustrazioni i punteggi sono meno
  affidabili.

### Tag di Eye utili qui

| Gruppo | Tag |
|---|---|
| Tipo di foto | `photo`, `selfie`, `screenshot`, `photo_of_screen`, `receipt`, `document`, `id_card`, `whiteboard`, `map`, `chart_or_slide`, `meme_or_graphic`, `illustration_or_art`, `shopping_reference`, `medical_reference`, `repair_reference`, `reference`, `other` |
| Tenere o buttare | `keeper`, `forgettable`, `accidental`, `technical_flaw`, `unusable`, `bad_framing`, `bad_lighting`, `test_or_duplicate_shot`, `reference_photo`, `low_content` |
| Qualità | `sharp`, `blurry`, `bokeh`, `peak_moment`, `rotated` |
| Persone | `people`, `group_shot`, `portrait`, `smiling`, `eyes_closed`, … |
| Sensibili | `sensitive`, `nsfw_explicit`, `nsfw_suggestive`, `blood_injury`, … |
| Scene | 558 classi Open Images (`dog`, `beach`, `food`…) |

Soglie: `"recommended"` = 0.5 (per smistare), `"strict"` = 0.9 (per azioni automatiche).

### API JavaScript reale (verificata installando `@desert-ant-labs/eye` 4.2.3)

```js
import { Eye, Tag } from "@desert-ant-labs/eye";           // browser
// import { Eye, Tag } from "@desert-ant-labs/eye/native"; // Node

const eye = await Eye.load({
  modelBaseUrl: "/models/eye/",   // browser: carica i file serviti dall'app (niente Hugging Face)
  // directory: "C:\\percorso",   // Node: cartella con i file del modello
  litertWasmDir: "/litert-wasm/", // runtime LiteRT locale invece di jsDelivr
  accelerator: "auto",            // "auto" | "wasm" | "webgpu" | "webnn"
  onProgress: (f) => {},
});

const foto = await eye.analyze(fileOBlob);   // browser: File, Blob, ImageBitmap, ImageData…
// Node: eye.analyze({ data, width, height }) con pixel RGB/RGBA già raddrizzati

foto.has("whiteboard");            // accetta stringhe; Tag.whiteboard esiste (camelCase: Tag.photoOfScreen)
foto.has("sensitive", "strict");
foto.confidence("screenshot");     // 0..1
foto.tags();                       // tag sopra soglia, dal più sicuro
foto.kind;                         // "photo", "screenshot", "document", …
foto.confidences;                  // tutti i tag con confidenza
foto.scores;                       // { aesthetic, keeper, cover }
JSON.stringify(foto);              // salvabile; Analysis.fromJSON per ripristinare

Eye.duplicates(analisi, { dates });  // gruppi di quasi-duplicati, il migliore per primo
Eye.best(analisi);                   // indice della foto da tenere
Eye.similar(foto, analisi, { limit });
eye.dispose();
```

---

## 3. Decisioni prese

1. **Provenienza dall'EXIF, non dal nome file.** L'utente aveva già rinominato tutti i file con uno
   script Python in `AAAA-MM-GG[n].ext` usando la data di **modifica**, quindi i nomi Android
   originali (`Screenshot_…`, `IMG-…-WA0001`) sono persi. Regole adottate:
   - EXIF con marca/modello del telefono → **fotocamera**;
   - `.webp` ≤ 512×512 senza EXIF → **sticker** WhatsApp;
   - nessun EXIF → **ricevuta** (WhatsApp e Instagram tolgono l'EXIF; non sono distinguibili tra loro).
2. **Attenzione alle date**: lo script di rinomina dell'utente usa la data di modifica, che può
   essere la data di copia e non di scatto. L'app riporta nel CSV la data di scatto EXIF
   (`DateTimeOriginal`) per confrontare. Possibile lavoro futuro: rinominare con la data di scatto.
3. **Web app invece di script Node**: Chrome ed Edge su Windows supportano la File System Access API
   (`showDirectoryPicker`), quindi una pagina può aprire una cartella e spostarci i file.
4. **Modello dentro l'app** (`public/models/eye/`, opzione `modelBaseUrl`): funziona offline,
   niente token.
5. **Mai cancellare**: l'app sposta soltanto in `_classificate\<categoria>`. Se `move()` non è
   disponibile copia il file, verifica la dimensione e solo allora rimuove l'originale (in quel
   caso la data di modifica cambia).
6. Categorie scartate: alternativa CLIP (modello open, zero-shot) proposta e **rifiutata**
   dall'utente; si resta su Desert Ant Labs.

---

## 4. L'app "Riordina foto"

Consegnata come `riordina-foto.zip` (Vite + JavaScript, nessun framework).

### Struttura

```
index.html              interfaccia: 3 passi + risultati + finestre di dettaglio e conferma
src/main.js             logica UI: modello, cartella, analisi, schede, griglia, spostamento, CSV
src/categorie.js        categorie e regole (modificabili)
src/analizzatore.js     caricamento Eye, modalità demo, provenienza da EXIF (exifr)
src/cartella.js         scelta cartella, elenco immagini, spostamento sicuro
src/style.css           stile chiaro/scuro
public/models/eye/      qui vanno eye.tflite ed eye_meta.json
scripts/copia-wasm.mjs  postinstall: copia il runtime LiteRT in public/litert-wasm
vite.config.js          header COOP/COEP (per LiteRT multi-thread)
LEGGIMI.md              istruzioni d'uso
```

Dipendenze: `@desert-ant-labs/eye`, `@litertjs/core`, `exifr`, `vite`.

### Categorie (in ordine di priorità, vince la prima)

| Cartella | Nome | Tag di Eye / regola |
|---|---|---|
| `lavagne` | Lavagne | `whiteboard` |
| `screenshot` | Screenshot | `screenshot` |
| `foto_schermo` | Foto di schermi | `photo_of_screen` |
| `documenti` | Documenti | `document`, `receipt`, `id_card`, `chart_or_slide` |
| `meme_grafiche` | Meme e grafiche | `meme_or_graphic`, `illustration_or_art` |
| `promemoria` | Promemoria | `reference`, `shopping_reference`, `repair_reference`, `medical_reference`, `map` |
| `scarti` | Scarti | `unusable`, `accidental`, `test_or_duplicate_shot`, `blurry` |
| `sticker` | Sticker | webp ≤ 512 px senza EXIF |
| `foto_ricevute` | Foto ricevute | foto normale senza EXIF |
| `foto` | Foto tue | tutto il resto (non selezionate per lo spostamento di default) |

### Funzioni

1. **Modello**: controlla se i file sono in `public/models/eye/` e li carica (WebGPU se disponibile,
   altrimenti CPU). Se mancano offre la **modalità demo** (categorie finte, solo per provare l'UI).
2. **Cartella**: "Scegli cartella…", opzione per includere le sottocartelle (esclude `_classificate`).
3. **Analisi**: barra di avanzamento, tempo stimato, pulsante Ferma / Riprendi.
4. **Revisione**: schede per categoria con conteggi, griglia di miniature caricate quando visibili,
   120 per pagina. Clic = seleziona/deseleziona; "i" = dettagli (tag con percentuale,
   provenienza, dispositivo, data di scatto, cambio categoria a mano).
5. **Sposta selezionate**: riepilogo e conferma, poi spostamento in `_classificate\<categoria>`.
6. **Esporta CSV**: `report-foto.csv` con separatore `;` (Excel italiano). Colonne: file,
   categoria, motivo, tipo, provenienza, dispositivo, data_scatto_exif, tag, spostata_in, errore.

### Verifiche fatte

- `npm run build` riuscito.
- Test end-to-end in Chrome headless con la **modalità demo** su 33 immagini di prova (cartella
  simulata con OPFS): scelta cartella, analisi, schede, dettaglio, conferma e spostamento in
  `_classificate\<categoria>` funzionano; nessun errore JavaScript.
- Parte EXIF verificata su immagini sintetiche (fotocamera / ricevuta / sticker).
- **Non ancora provato con il modello Eye vero**: va fatto sul PC dell'utente.

---

## 5. Istruzioni di installazione (PowerShell)

```powershell
# 1. Node.js installato?
node -v
npm -v

# 2. Entrare nella cartella del progetto (se c'è una sottocartella riordina-foto, entrarci)
cd "C:\Users\paulb\Documents\GitHub\Gestione_file\Classificatore foto"
dir

# 3. Dipendenze (deve comparire "Runtime LiteRT copiato in public/litert-wasm")
npm install

# 4. Scaricare il modello dentro l'app
Invoke-WebRequest "https://huggingface.co/desert-ant-labs/eye/resolve/main/eye.tflite" -OutFile "public\models\eye\eye.tflite"
Invoke-WebRequest "https://huggingface.co/desert-ant-labs/eye/resolve/main/eye_meta.json" -OutFile "public\models\eye\eye_meta.json"
dir public\models\eye   # eye.tflite ~66 MB, eye_meta.json ~281 KB

# 5. Avviare (aprire http://localhost:5173 in Chrome o Edge)
npm run dev
```

In alto a destra deve comparire **"Modello Eye pronto"**. Per fermare: `Ctrl+C` in PowerShell.

**Primo test**: copiare 50-100 foto miste in una cartella di prova (es. `D:\test-foto`), analizzare,
controllare le schede, provare lo spostamento. Solo dopo passare alla cartella vera.

---

## 6. Script precedenti (sostituiti dall'app)

- `classifica-foto.mjs`: script Node da riga di comando con le stesse categorie, provenienza da
  EXIF, report CSV e opzione `--sposta`. Usa `@desert-ant-labs/eye/native` + `sharp` + `exifr`.
  Superato dalla web app, ma utile se servisse un'elaborazione senza interfaccia.
- Script Python dell'utente per rinominare i file in `AAAA-MM-GG[n].ext` in base alla data di
  modifica (già eseguito sulla cartella del telefono).

---

## 7. Stato attuale e prossimi passi

**Stato**: l'utente sta installando l'app sul PC (passi PowerShell del punto 5). In attesa di sapere
se compare "Modello Eye pronto" e come va il primo test.

**Possibili problemi da controllare al primo avvio**

- Nomi dei file del modello diversi o in sottocartella su Hugging Face → adattare `analizzatore.js`.
- Download incompleto (file di pochi KB) → riscaricare.
- Errori di caricamento del runtime LiteRT o WebGPU → provare `accelerator: "wasm"` in
  `analizzatore.js`.
- Firefox non supporta la scelta della cartella → usare Chrome o Edge.

**Idee per le prossime versioni**

1. Scheda **Duplicati** con `Eye.duplicates` ed `Eye.best` (raffiche e foto quasi uguali).
2. Salvare le analisi (JSON o IndexedDB) per non rianalizzare ogni volta.
3. Spostare l'analisi in un **Web Worker** per un'interfaccia più fluida su cartelle grandi.
4. Rinominare le foto della fotocamera con la **data di scatto EXIF** invece della data di modifica.
5. Gestire anche i **video** (oggi ignorati).
6. Impacchettare come app desktop (Electron o Tauri) con il modello incluso.
