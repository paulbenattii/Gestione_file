// Carica il modello Eye dai file serviti dall'app (public/models/eye/)
// oppure, se mancano, offre una modalità demo con risultati finti per provare l'interfaccia.
import exifr from "exifr";
import { SOGLIA } from "./categorie.js";

const BASE_MODELLO = "/models/eye/";
const FILE_MODELLO = ["eye.tflite", "eye_meta.json"];

export async function modelloPresente() {
  try {
    const risposte = await Promise.all(
      FILE_MODELLO.map((f) => fetch(BASE_MODELLO + f, { method: "HEAD", cache: "no-store" })),
    );
    // Vite risponde con index.html (text/html) ai percorsi che non esistono
    return risposte.every((r) => r.ok && !(r.headers.get("content-type") ?? "").includes("text/html"));
  } catch {
    return false;
  }
}

const sopraSoglia = (conf) =>
  Object.fromEntries(
    Object.entries(conf ?? {})
      .filter(([, c]) => c >= SOGLIA)
      .sort((a, b) => b[1] - a[1])
      .map(([t, c]) => [t, Math.round(c * 1000) / 1000]),
  );

const piuProbabile = (punteggi) => Object.entries(punteggi ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

/**
 * Versione compatta di un'analisi di Eye (meno di 3 KB invece di oltre 30 KB): tiene tutto ciò che
 * il modello dice della foto e che serve all'app, butta i dati grezzi (mappe, punti del viso, ritagli).
 * @returns {Riassunto}
 *
 * @typedef {object} Riassunto
 * @property {string|null} kind tipo di immagine più probabile
 * @property {Record<string, number>} confidences tag sopra soglia, dal più sicuro
 * @property {{ aesthetic: number, keeper: number, cover: number }|null} scores percentili 0–1 rispetto a foto tipiche
 * @property {number|null} nitidezza probabilità che una persona la giudichi nitida
 * @property {number|null} rotazione gradi in senso orario rispetto al dritto
 * @property {number} persone persone individuate (riquadri sopra soglia)
 * @property {string[]} animali "cat" / "dog" per ogni animale individuato
 * @property {string|null} inquadratura come è inquadrata la persona principale
 * @property {Array<{ box, detection_confidence: number, quality: number, tags: Record<string, number> }>} volti
 * @property {Float32Array|null} embedding 512 numeri per trovare foto simili e doppioni
 * @property {object|null} regolaDoppioni soglie del modello per i doppioni
 * @property {{ model: string, width: number, height: number }} info
 */
function riassumi(analisi) {
  const dettagli = analisi.details;
  const persone = (analisi.people ?? []).filter((p) => p.confidence >= SOGLIA).length;
  return {
    kind: analisi.kind ?? null,
    confidences: sopraSoglia(analisi.confidences),
    scores: analisi.scores ?? null,
    nitidezza: dettagli?.sharpness?.score ?? null,
    rotazione: analisi.rotation ?? null,
    persone,
    animali: (analisi.pets ?? []).filter((p) => p.confidence >= SOGLIA).map((p) => p.label),
    inquadratura: persone ? piuProbabile(dettagli?.layout?.shot) : null,
    volti: (analisi.faces ?? []).map((f) => ({
      box: f.box,
      detection_confidence: f.detectionConfidence,
      quality: f.quality,
      tags: sopraSoglia(f.confidences),
    })),
    embedding: analisi.embedding ?? null,
    regolaDoppioni: analisi.toJSON().duplicates ?? null,
    info: { model: analisi.model, width: analisi.width, height: analisi.height },
  };
}

/** Ricostruisce dal riassunto l'oggetto Analysis che Eye.duplicates/Eye.best si aspettano. */
function comeAnalysis(Analysis, r) {
  return Analysis.fromJSON({
    ...r.info,
    kind: r.kind,
    tags: r.confidences,
    scores: r.scores,
    rotation: r.rotazione,
    embedding: r.embedding,
    faces: r.volti,
    duplicates: r.regolaDoppioni,
  });
}

/**
 * @param {(frazione: number) => void} onProgresso
 */
export async function caricaEye(onProgresso) {
  const { Eye, Analysis } = await import("@desert-ant-labs/eye");
  const acceleratore = "gpu" in navigator ? "auto" : "wasm";
  const eye = await Eye.load({
    modelBaseUrl: BASE_MODELLO,
    litertWasmDir: "/litert-wasm/",
    accelerator: acceleratore,
    onProgress: onProgresso,
  });
  return {
    demo: false,
    acceleratore: acceleratore === "auto" ? "WebGPU (o CPU se non disponibile)" : "CPU (WebAssembly)",
    // Tutte e quattro le parti (photo, layout, faces, sharpness): l'analisi più completa che Eye offre
    analizza: async (immagine) => riassumi(await eye.analyze(immagine)),
    /**
     * Gruppi di quasi-doppioni (indici in `riassunti`), ognuno con la foto migliore per prima.
     * `date` in secondi: solo foto scattate a pochi secondi l'una dall'altra contano come doppioni.
     */
    doppioni: (riassunti, date) => Eye.duplicates(riassunti.map((r) => comeAnalysis(Analysis, r)), { dates: date }),
    chiudi: () => eye.dispose(),
  };
}

/** Risultati FINTI, solo per provare l'interfaccia senza il modello. */
export function caricaDemo() {
  const tipi = ["photo", "photo", "photo", "screenshot", "whiteboard", "meme_or_graphic", "document", "photo_of_screen", "blurry"];
  const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return {
    demo: true,
    acceleratore: "nessuno (demo)",
    async analizza(immagine, file) {
      await new Promise((r) => setTimeout(r, 15));
      const tipo = file.type === "image/png" ? "screenshot" : tipi[hash(file.name) % tipi.length];
      return {
        kind: tipo, confidences: { [tipo]: 0.93 }, scores: null, nitidezza: null, rotazione: null,
        persone: 0, animali: [], inquadratura: null, volti: [], embedding: null, regolaDoppioni: null, info: null,
      };
    },
    doppioni: () => [],
    chiudi() {},
  };
}

/**
 * Da dove arriva una foto, letto dai metadati EXIF:
 * - fotocamera: ha marca/modello del telefono
 * - sticker: .webp piccolo (gli sticker WhatsApp sono 512x512)
 * - ricevuta: niente EXIF (WhatsApp e Instagram lo tolgono quando ricomprimono)
 * @param {File} file
 * @param {ImageBitmap|null} [bitmap] l'immagine già decodificata, se c'è: evita di decodificarla di nuovo
 */
export async function provenienza(file, bitmap = null) {
  let exif = null;
  try {
    exif = await exifr.parse(file, ["Make", "Model", "DateTimeOriginal"]);
  } catch {
    /* file senza EXIF o non leggibile */
  }
  if (exif?.Make || exif?.Model) {
    return {
      provenienza: "fotocamera",
      dispositivo: [exif.Make, exif.Model].filter(Boolean).join(" "),
      dataScatto: exif.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal : null,
    };
  }
  if (file.type === "image/webp" || /\.webp$/i.test(file.name)) {
    const dim = bitmap ?? (await dimensioni(file));
    if (dim && dim.width <= 512 && dim.height <= 512) return { provenienza: "sticker", dispositivo: "", dataScatto: null };
  }
  return { provenienza: "ricevuta", dispositivo: "", dataScatto: null };
}

async function dimensioni(file) {
  try {
    const bmp = await createImageBitmap(file);
    const d = { width: bmp.width, height: bmp.height };
    bmp.close();
    return d;
  } catch {
    return null;
  }
}
