// Carica il modello Eye dai file serviti dall'app (public/models/eye/)
// oppure, se mancano, offre una modalità demo con risultati finti per provare l'interfaccia.
import exifr from "exifr";

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

/**
 * @param {(frazione: number) => void} onProgresso
 * @returns {Promise<{ analizza: (file: File) => Promise<any>, acceleratore: string, demo: boolean, chiudi: () => void }>}
 */
export async function caricaEye(onProgresso) {
  const { Eye } = await import("@desert-ant-labs/eye");
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
    analizza: (file) => eye.analyze(file),
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
    async analizza(file) {
      await new Promise((r) => setTimeout(r, 15));
      const tipo = file.type === "image/png" ? "screenshot" : tipi[hash(file.name) % tipi.length];
      const confidences = { [tipo]: 0.93 };
      return {
        kind: tipo,
        width: 0,
        height: 0,
        confidences,
        has: (t) => (confidences[t] ?? 0) >= 0.5,
        tags: () => Object.keys(confidences),
      };
    },
    chiudi() {},
  };
}

/**
 * Da dove arriva una foto, letto dai metadati EXIF:
 * - fotocamera: ha marca/modello del telefono
 * - sticker: .webp piccolo (gli sticker WhatsApp sono 512x512)
 * - ricevuta: niente EXIF (WhatsApp e Instagram lo tolgono quando ricomprimono)
 */
export async function provenienza(file) {
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
    const dim = await dimensioni(file);
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
