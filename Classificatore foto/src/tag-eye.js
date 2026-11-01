// Famiglie e nomi italiani dei tag di Eye, ricavati dai commenti di @desert-ant-labs/eye/tags.d.ts.
// Ogni tag che non è qui è una scena di Open Images (cane, spiaggia, tavolo…) e resta in inglese.

export const FAMIGLIE = [
  { id: "tipo",      nome: "Tipo di immagine" },
  { id: "qualita",   nome: "Qualità" },
  { id: "scarto",    nome: "Tenere o buttare" },
  { id: "persone",   nome: "Persone" },
  { id: "volto",     nome: "Espressioni e sguardo" },
  { id: "foto",      nome: "Foto" },
  { id: "sensibile", nome: "Contenuti sensibili" },
  { id: "scena",     nome: "Cosa c'è nella foto" },
];

/** tag → [famiglia, nome italiano] */
const TAG = {
  photo: ["tipo", "foto"],
  selfie: ["tipo", "selfie"],
  screenshot: ["tipo", "screenshot"],
  photo_of_screen: ["tipo", "foto di uno schermo"],
  whiteboard: ["tipo", "lavagna"],
  document: ["tipo", "documento"],
  receipt: ["tipo", "scontrino"],
  id_card: ["tipo", "documento d'identità"],
  chart_or_slide: ["tipo", "grafico o slide"],
  meme_or_graphic: ["tipo", "meme o grafica"],
  illustration_or_art: ["tipo", "illustrazione o arte"],
  map: ["tipo", "mappa"],
  reference: ["tipo", "promemoria"],
  shopping_reference: ["tipo", "promemoria acquisti"],
  repair_reference: ["tipo", "promemoria riparazione"],
  medical_reference: ["tipo", "promemoria medico"],
  other: ["tipo", "altro"],

  sharp: ["qualita", "nitida"],
  blurry: ["qualita", "sfocata"],
  bokeh: ["qualita", "sfondo sfocato"],

  keeper: ["scarto", "da tenere"],
  forgettable: ["scarto", "dimenticabile"],
  accidental: ["scarto", "scattata per sbaglio"],
  unusable: ["scarto", "inutilizzabile"],
  technical_flaw: ["scarto", "difetto tecnico"],
  bad_framing: ["scarto", "inquadratura sbagliata"],
  bad_lighting: ["scarto", "luce sbagliata"],
  low_content: ["scarto", "poco contenuto"],
  test_or_duplicate_shot: ["scarto", "prova o doppione"],
  reference_photo: ["scarto", "foto di riferimento"],

  people: ["persone", "persone"],
  portrait: ["persone", "ritratto"],
  group_shot: ["persone", "foto di gruppo"],
  candid: ["persone", "spontanea"],
  everyone_looking: ["persone", "tutti guardano in camera"],
  everyone_smiling: ["persone", "tutti sorridono"],
  eyes_closed: ["volto", "occhi chiusi"],
  smiling: ["volto", "sorride"],
  happy: ["volto", "felice"],
  surprised: ["volto", "sorpreso"],
  looking_at_camera: ["volto", "guarda in camera"],
  looking_away: ["volto", "guarda altrove"],

  peak_moment: ["foto", "momento clou"],
  rotated: ["foto", "ruotata"],

  sensitive: ["sensibile", "sensibile"],
  nsfw_explicit: ["sensibile", "nudo esplicito"],
  nsfw_suggestive: ["sensibile", "provocante"],
  blood_injury: ["sensibile", "sangue o ferite"],
  weapon: ["sensibile", "armi"],
  violence_protest: ["sensibile", "violenza o proteste"],
  accident_disaster: ["sensibile", "incidente o disastro"],
  medical_hospital: ["sensibile", "medico o ospedale"],
  funeral: ["sensibile", "funerale"],
};

export const famiglia = (tag) => TAG[tag]?.[0] ?? "scena";
export const nomeTag = (tag) => TAG[tag]?.[1] ?? tag.replaceAll("_", " ");
