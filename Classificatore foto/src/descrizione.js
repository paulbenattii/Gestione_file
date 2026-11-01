// Trasforma il riassunto di un'analisi di Eye in testo leggibile, per il dettaglio e per il CSV.
import { FAMIGLIE, famiglia, nomeTag } from "./tag-eye.js";

const pc = (x) => `${Math.round(x * 100)}%`;
const INQUADRATURA = { extreme_close_up: "primissimo piano", close_up: "primo piano", medium: "piano medio", wide: "campo largo" };
const ANIMALE = { cat: "gatto", dog: "cane" };

/** Tag sopra soglia raggruppati per famiglia, nell'ordine di FAMIGLIE: [{ famiglia, tag: [[tag, conf]] }]. */
export function tagPerFamiglia(confidences) {
  const gruppi = Object.fromEntries(FAMIGLIE.map((f) => [f.id, []]));
  for (const [t, c] of Object.entries(confidences ?? {})) gruppi[famiglia(t)].push([t, c]);
  return FAMIGLIE.filter((f) => gruppi[f.id].length).map((f) => ({ famiglia: f, tag: gruppi[f.id] }));
}

const contaAnimali = (animali) =>
  Object.entries(animali.reduce((n, a) => ({ ...n, [a]: (n[a] ?? 0) + 1 }), {}))
    .map(([a, n]) => `${n} ${ANIMALE[a] ?? a}`)
    .join(", ");

/** Righe "etichetta: valore" con tutto ciò che Eye ha detto della foto, oltre ai tag. */
export function voci(analisi, doppioneDi) {
  if (!analisi) return [];
  const righe = [];
  if (analisi.kind) righe.push(["Tipo", nomeTag(analisi.kind)]);
  if (analisi.nitidezza != null) righe.push(["Nitidezza", pc(analisi.nitidezza)]);
  if (analisi.scores) {
    // Sono percentili rispetto a foto tipiche: 80 su 100 vuol dire meglio dell'80% delle foto
    const su100 = (x) => `${Math.round(x * 100)} su 100`;
    righe.push(["Bellezza", su100(analisi.scores.aesthetic)]);
    righe.push(["Da tenere", su100(analisi.scores.keeper)]);
    righe.push(["Come copertina", su100(analisi.scores.cover)]);
  }
  if (analisi.rotazione) righe.push(["Rotazione", `girata di ${analisi.rotazione}° in senso orario`]);
  if (analisi.persone) {
    const inq = INQUADRATURA[analisi.inquadratura];
    righe.push(["Persone", `${analisi.persone}${inq ? ` · ${inq}` : ""}`]);
  }
  if (analisi.volti?.length) righe.push(["Volti trovati", String(analisi.volti.length)]);
  if (analisi.animali?.length) righe.push(["Animali", contaAnimali(analisi.animali)]);
  if (doppioneDi) righe.push(["Doppione di", doppioneDi]);
  return righe;
}

/** "Volto 1 (qualità 80%): occhi chiusi, sorride" per ogni volto. */
export function descriviVolti(analisi) {
  return (analisi?.volti ?? []).map((v, i) => {
    const tag = Object.keys(v.tags).map(nomeTag).join(", ");
    return `Volto ${i + 1} (qualità ${pc(v.quality)})${tag ? `: ${tag}` : ""}`;
  });
}

/** Colonne aggiuntive del CSV, nell'ordine di INTESTAZIONE_CSV. */
export const INTESTAZIONE_CSV = [
  "nitidezza", "estetica", "da_tenere", "copertina", "rotazione", "persone", "inquadratura", "volti", "volti_dettaglio",
  "animali", "tag", "scene", "sensibili",
];

export function colonneCsv(a) {
  if (!a) return INTESTAZIONE_CSV.map(() => "");
  const fam = (f) => Object.keys(a.confidences).filter((t) => famiglia(t) === f);
  const num = (x) => (x == null ? "" : Math.round(x * 100));
  return [
    num(a.nitidezza), num(a.scores?.aesthetic), num(a.scores?.keeper), num(a.scores?.cover),
    a.rotazione ?? "", a.persone || "", INQUADRATURA[a.inquadratura] ?? "", a.volti.length || "",
    descriviVolti(a).join(" | "), contaAnimali(a.animali),
    Object.keys(a.confidences).filter((t) => !["scena", "sensibile"].includes(famiglia(t))).map(nomeTag).join(", "),
    fam("scena").slice(0, 12).map(nomeTag).join(", "),
    fam("sensibile").map(nomeTag).join(", "),
  ];
}
