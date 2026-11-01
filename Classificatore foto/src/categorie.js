// Categorie dell'app e regole per assegnarle.
// Fra le categorie con almeno un tag sopra soglia vince quella col tag più sicuro;
// a parità di confidenza vince quella che viene prima nell'elenco.
// La soglia "recommended" (0.5) è quella consigliata da Desert Ant Labs per smistare;
// tanto prima di spostare qualcosa lo rivedi tu.
//
// Per cambiare le categorie modifica l'elenco qui sotto:
// - id:   nome della sottocartella in _classificate (niente spazi o caratteri strani)
// - nome: come appare nelle schede
// - tag:  tag di Eye che fanno finire una foto qui (elenco: https://desertant.com/docs/eye/)
// "sticker", "foto_ricevute" e "foto" non hanno tag: sono assegnate dall'EXIF e vanno lasciate.
// "doppioni" non ha tag: a fine analisi ci finiscono le copie quasi uguali di una foto (resta fuori la migliore).

export const CATEGORIE = [
  { id: "lavagne",       nome: "Lavagne",          tag: ["whiteboard"] },
  { id: "screenshot",    nome: "Screenshot",       tag: ["screenshot"] },
  { id: "foto_schermo",  nome: "Foto di schermi",  tag: ["photo_of_screen"] },
  { id: "documenti",     nome: "Documenti",        tag: ["document", "receipt", "id_card", "chart_or_slide"] },
  { id: "meme_grafiche", nome: "Meme e grafiche",  tag: ["meme_or_graphic", "illustration_or_art"] },
  { id: "promemoria",    nome: "Promemoria",       tag: ["reference", "shopping_reference", "repair_reference", "medical_reference", "map"] },
  { id: "scarti",        nome: "Scarti",           tag: ["unusable", "accidental", "test_or_duplicate_shot", "blurry"] },
  { id: "occhi_chiusi",  nome: "Occhi chiusi",     tag: ["eyes_closed"] },
  { id: "doppioni",      nome: "Doppioni",         tag: [] },
  { id: "sticker",       nome: "Sticker",          tag: [] },
  { id: "foto_ricevute", nome: "Foto ricevute",    tag: [] },
  { id: "foto",          nome: "Foto tue",         tag: [] },
];

export const SOGLIA = 0.5;

export const PER_ID = Object.fromEntries(CATEGORIE.map((c) => [c.id, c]));

/** Categorie le cui foto restano dove sono, salvo che tu le selezioni a mano. */
export const NON_SPOSTARE_DI_DEFAULT = new Set(["foto"]);

/**
 * @param {{ confidences: Record<string, number> }} analisi
 * @param {"fotocamera"|"sticker"|"ricevuta"} provenienza
 * @returns {{ categoria: string, motivo: string }}
 */
export function assegnaCategoria(analisi, provenienza) {
  if (provenienza === "sticker") return { categoria: "sticker", motivo: "webp piccolo senza EXIF" };
  let migliore = null;
  for (const c of CATEGORIE) {
    for (const t of c.tag) {
      const conf = analisi.confidences[t] ?? 0;
      if (conf >= SOGLIA && (!migliore || conf > migliore.conf)) migliore = { categoria: c.id, tag: t, conf };
    }
  }
  if (migliore) return { categoria: migliore.categoria, motivo: `${migliore.tag} ${Math.round(migliore.conf * 100)}%` };
  if (provenienza === "ricevuta") return { categoria: "foto_ricevute", motivo: "nessun EXIF di fotocamera" };
  return { categoria: "foto", motivo: "" };
}
