// Categorie dell'app e regole per assegnarle.
// Le regole vengono controllate in ordine: vince la prima che corrisponde.
// La soglia "recommended" (0.5) è quella consigliata da Desert Ant Labs per smistare;
// tanto prima di spostare qualcosa lo rivedi tu.

export const CATEGORIE = [
  { id: "lavagne",       nome: "Lavagne",          tag: ["whiteboard"] },
  { id: "screenshot",    nome: "Screenshot",       tag: ["screenshot"] },
  { id: "foto_schermo",  nome: "Foto di schermi",  tag: ["photo_of_screen"] },
  { id: "documenti",     nome: "Documenti",        tag: ["document", "receipt", "id_card", "chart_or_slide"] },
  { id: "meme_grafiche", nome: "Meme e grafiche",  tag: ["meme_or_graphic", "illustration_or_art"] },
  { id: "promemoria",    nome: "Promemoria",       tag: ["reference", "shopping_reference", "repair_reference", "medical_reference", "map"] },
  { id: "scarti",        nome: "Scarti",           tag: ["unusable", "accidental", "test_or_duplicate_shot", "blurry"] },
  { id: "sticker",       nome: "Sticker",          tag: [] },
  { id: "foto_ricevute", nome: "Foto ricevute",    tag: [] },
  { id: "foto",          nome: "Foto tue",         tag: [] },
];

export const PER_ID = Object.fromEntries(CATEGORIE.map((c) => [c.id, c]));

/** Categorie le cui foto restano dove sono, salvo che tu le selezioni a mano. */
export const NON_SPOSTARE_DI_DEFAULT = new Set(["foto"]);

/**
 * @param {import("@desert-ant-labs/eye").Analysis} analisi
 * @param {"fotocamera"|"sticker"|"ricevuta"} provenienza
 * @returns {{ categoria: string, motivo: string }}
 */
export function assegnaCategoria(analisi, provenienza) {
  if (provenienza === "sticker") return { categoria: "sticker", motivo: "webp piccolo senza EXIF" };
  for (const c of CATEGORIE) {
    for (const t of c.tag) {
      if (analisi.has(t)) return { categoria: c.id, motivo: t };
    }
  }
  if (provenienza === "ricevuta") return { categoria: "foto_ricevute", motivo: "nessun EXIF di fotocamera" };
  return { categoria: "foto", motivo: "" };
}
