# Riordina foto

Web app che classifica le foto di una cartella del tuo PC con il modello **Eye** di Desert Ant Labs
(lavagne, screenshot, foto di schermi, documenti, meme, scarti, sticker…) e poi, dopo che le hai
riviste, le sposta in sottocartelle. Tutto gira nel browser: nessuna foto lascia il computer.
L'app **non cancella mai nulla**: sposta soltanto, dentro `_classificate` nella cartella scelta.

Serve **Chrome** o **Edge** (gli unici che permettono a una pagina di aprire e modificare una cartella).

## Primo avvio

1. Installa [Node.js](https://nodejs.org) (versione LTS).
2. Apri PowerShell in questa cartella e lancia:
   ```
   npm install
   npm run dev
   ```
   Si apre il browser su `http://localhost:5173`.
3. Senza il modello puoi già provare l'interfaccia con **"modalità demo"**: le categorie sono finte,
   non usarla per spostare foto vere.

## Mettere il modello dentro l'app

Eye è in beta chiusa, quindi i pesi su Hugging Face sono ad accesso riservato.

1. Crea un account su [huggingface.co](https://huggingface.co) e chiedi l'accesso su
   [desert-ant-labs/eye](https://huggingface.co/desert-ant-labs/eye)
   (o scrivi a Desert Ant Labs da [desertant.com/contact](https://desertant.com/contact/)).
2. Quando sei approvato, dalla scheda *Files* del modello scarica:
   - `eye.tflite` (circa 66 MB)
   - `eye_meta.json`
3. Mettili in `public/models/eye/` e ricarica la pagina.

Da quel momento l'app non ha più bisogno di Hugging Face né di un token: il modello è dentro l'app.

## Come funziona

1. **Modello**: l'app controlla se i file sono in `public/models/eye/` e li carica. Usa la scheda
   video (WebGPU) se disponibile, altrimenti la CPU.
2. **Cartella**: scegli la cartella delle foto (ed eventualmente le sottocartelle).
3. **Analisi**: per ogni immagine Eye assegna i tag; l'EXIF dice se è stata scattata con la
   fotocamera o ricevuta (WhatsApp e Instagram tolgono l'EXIF).
4. **Revisione**: una scheda per categoria. Clic su una foto = selezionata/non selezionata.
   La "i" apre i dettagli, dove puoi cambiare categoria a mano. Le "Foto tue" non sono selezionate
   di default.
5. **Sposta selezionate**: le foto finiscono in `_classificate/<categoria>`. Da lì le guardi e
   cancelli tu quello che non vuoi.
6. **Esporta CSV**: report apribile in Excel (separatore `;`).

## Le categorie

Le regole sono in `src/categorie.js`, in ordine di priorità: puoi aggiungere, togliere o riordinare
i tag. L'elenco completo dei tag di Eye è nella
[documentazione](https://desertant.com/docs/eye/).

## Da sapere

- L'SDK di Desert Ant Labs invia statistiche d'uso anonime (conteggio delle chiamate, per la
  licenza) a `events.desertant.com`. Le immagini restano sul computer.
- Se il browser non supporta lo spostamento diretto, l'app copia il file, controlla che la copia
  sia completa e solo allora rimuove l'originale. In quel caso la data di modifica del file diventa
  quella dello spostamento.
- Licenza dei modelli: [Desert Ant Labs Source-Available License](https://license.desertant.com/).
  Gratis per uso personale.

## Struttura

```
index.html            interfaccia
src/main.js           logica dell'interfaccia (passi, griglia, spostamento, CSV)
src/categorie.js      categorie e regole
src/analizzatore.js   caricamento di Eye, modalità demo, provenienza da EXIF
src/cartella.js       scelta cartella, elenco immagini, spostamento sicuro
public/models/eye/    qui vanno i file del modello
```
