import { CATEGORIE, PER_ID, NON_SPOSTARE_DI_DEFAULT, assegnaCategoria } from "./categorie.js";
import { modelloPresente, caricaEye, caricaDemo, provenienza } from "./analizzatore.js";
import { tagPerFamiglia, voci as righeAnalisi, descriviVolti, INTESTAZIONE_CSV, colonneCsv } from "./descrizione.js";
import { nomeTag } from "./tag-eye.js";
import { supportato, scegliCartella, permessoScrittura, elencaImmagini, sposta, NOME_USCITA } from "./cartella.js";

const $ = (id) => document.getElementById(id);
const PER_PAGINA = 120;

const stato = {
  analizzatore: null,
  radice: null,
  /** @type {Array<{handle, cartella, percorso, indice, provenienza?, dispositivo?, dataScatto?, dataFile?, analisi?, categoria?, doppioneDi?, motivo?, selezionata?, spostataIn?, errore?}>} */
  voci: [],
  fermato: false,
  scheda: null,
  mostrate: PER_PAGINA,
};

// ---------- 1. Modello ----------

function impostaStatoModello(testo, classe) {
  const p = $("stato-modello");
  p.textContent = testo;
  p.className = `pillola ${classe ?? ""}`;
}

function modelloPronto(analizzatore) {
  stato.analizzatore = analizzatore;
  $("barra-modello").hidden = true;
  $("modello-mancante").hidden = true;
  if (analizzatore.demo) {
    impostaStatoModello("Modalità demo: risultati finti", "demo");
    $("testo-modello").textContent =
      "Modalità demo attiva: le categorie sono assegnate a caso, servono solo per provare l'interfaccia. Non spostare foto vere in questa modalità.";
  } else {
    impostaStatoModello("Modello Eye pronto", "ok");
    $("testo-modello").textContent = `Modello Eye caricato. Calcolo su: ${analizzatore.acceleratore}.`;
  }
  $("passo-cartella").setAttribute("aria-disabled", "false");
}

async function avviaModello() {
  if (!supportato()) $("avviso-browser").hidden = false;

  if (!(await modelloPresente())) {
    impostaStatoModello("Modello mancante");
    $("testo-modello").textContent = "I file del modello Eye non sono ancora nell'app.";
    $("modello-mancante").hidden = false;
    return;
  }
  $("testo-modello").textContent = "Carico il modello…";
  $("barra-modello").hidden = false;
  try {
    const analizzatore = await caricaEye((f) => ($("barra-modello").firstElementChild.style.width = `${Math.round(f * 100)}%`));
    modelloPronto(analizzatore);
  } catch (err) {
    console.error(err);
    impostaStatoModello("Errore nel modello");
    $("barra-modello").hidden = true;
    $("testo-modello").textContent = `Non riesco a caricare il modello: ${err.message ?? err}`;
    $("modello-mancante").hidden = false;
  }
}

$("btn-demo").addEventListener("click", () => modelloPronto(caricaDemo()));

// ---------- 2. Cartella ----------

$("btn-cartella").addEventListener("click", async () => {
  try {
    stato.radice = await scegliCartella();
  } catch (err) {
    if (err.name !== "AbortError") alert(`Non riesco ad aprire la cartella: ${err.message}`);
    return;
  }
  await contaImmagini();
});

$("chk-sottocartelle").addEventListener("change", () => stato.radice && contaImmagini());

async function contaImmagini() {
  chiudiSimili();
  $("testo-cartella").textContent = `Cerco le immagini in "${stato.radice.name}"…`;
  stato.voci = await elencaImmagini(stato.radice, { sottocartelle: $("chk-sottocartelle").checked });
  stato.voci.forEach((v, i) => (v.indice = i));
  $("testo-cartella").textContent =
    `"${stato.radice.name}": ${stato.voci.length.toLocaleString("it-IT")} immagini trovate` +
    ($("chk-sottocartelle").checked ? ` (sottocartelle incluse, esclusa ${NOME_USCITA}).` : ".");
  $("btn-analizza").disabled = stato.voci.length === 0;
  $("btn-analizza").textContent = "Avvia analisi";
  $("passo-analisi").hidden = true;
  $("risultati").hidden = true;
  stato.scheda = null;
}

// ---------- 3. Analisi ----------

$("btn-analizza").addEventListener("click", analizzaTutto);
$("btn-ferma").addEventListener("click", () => (stato.fermato = true));

async function analizzaTutto() {
  chiudiSimili();
  stato.fermato = false;
  $("btn-analizza").disabled = true;
  $("btn-cartella").disabled = true;
  $("passo-analisi").hidden = false;
  $("btn-ferma").hidden = false;
  $("risultati").hidden = false;
  stato.scheda = null;

  const totale = stato.voci.length;
  // Solo quelle ancora da fare: alla ripresa le già analizzate non falsano il tempo rimanente
  const daFare = stato.voci.filter((v) => !v.analisi && !v.spostataIn);
  const giaFatte = totale - daFare.length;
  const inizio = performance.now();
  let ultimoRender = 0;

  // Pipeline a due: mentre il modello analizza una foto, la successiva viene già letta e decodificata
  let prossima = daFare.length ? preparaSicura(daFare[0]) : null;
  for (let k = 0; k < daFare.length && !stato.fermato; k++) {
    const voce = daFare[k];
    const inArrivo = prossima;
    prossima = k + 1 < daFare.length ? preparaSicura(daFare[k + 1]) : null;
    const pronta = await inArrivo;
    delete voce.errore;
    try {
      if (pronta.errore) throw pronta.errore;
      const { provenienza, dispositivo, dataScatto } = pronta;
      Object.assign(voce, { provenienza, dispositivo, dataScatto });
      voce.dataFile = pronta.file.lastModified;
      voce.analisi = await stato.analizzatore.analizza(pronta.bitmap ?? pronta.file, pronta.file);
      categoriaDaiTag(voce);
    } catch (err) {
      voce.errore = String(err.message ?? err);
    } finally {
      pronta.bitmap?.close();
    }

    const fatteOra = k + 1;
    const fatte = giaFatte + fatteOra;
    $("barra-analisi").firstElementChild.style.width = `${(fatte / totale) * 100}%`;
    const secondi = (performance.now() - inizio) / 1000;
    const rimanenti = Math.round((secondi / fatteOra) * (daFare.length - fatteOra));
    $("testo-analisi").textContent =
      `${fatte.toLocaleString("it-IT")} di ${totale.toLocaleString("it-IT")} · circa ${formattaDurata(rimanenti)} rimanenti`;
    if (performance.now() - ultimoRender > 700) {
      ultimoRender = performance.now();
      disegnaSchede();
      aggiungiNuoveTessere();
    }
  }
  // Fermata a metà: la foto già preparata non serve più, libera la sua memoria
  prossima?.then((p) => p.bitmap?.close());

  const doppioni = segnaDoppioni();
  const errori = stato.voci.filter((v) => v.errore).length;
  $("testo-analisi").textContent =
    (stato.fermato ? "Analisi fermata. " : "Analisi completata. ") +
    `${stato.voci.filter((v) => v.analisi).length.toLocaleString("it-IT")} immagini analizzate` +
    (doppioni ? `, ${doppioni.toLocaleString("it-IT")} doppioni` : "") +
    (errori ? `, ${errori} non leggibili.` : ".");
  $("btn-ferma").hidden = true;
  $("btn-cartella").disabled = false;
  $("btn-analizza").disabled = !stato.voci.some((v) => !v.analisi && !v.spostataIn && !v.errore);
  $("btn-analizza").textContent = $("btn-analizza").disabled ? "Avvia analisi" : "Riprendi analisi";
  disegnaSchede();
  disegnaGriglia();
}

function imposta(voce, categoria, motivo) {
  if (voce.categoria !== categoria) voce.selezionata = !NON_SPOSTARE_DI_DEFAULT.has(categoria);
  voce.categoria = categoria;
  voce.motivo = motivo;
}

const sceltaAMano = (v) => v.motivo?.startsWith("scelta a mano");

function categoriaDaiTag(voce) {
  const { categoria, motivo } = assegnaCategoria(voce.analisi, voce.provenienza);
  imposta(voce, categoria, motivo);
}

/**
 * A fine analisi: raggruppa le foto quasi uguali scattate a pochi secondi l'una dall'altra.
 * La migliore di ogni gruppo (occhi aperti, volti migliori, più "da tenere") resta nella sua categoria,
 * le altre vanno in "Doppioni". Le categorie scelte a mano non si toccano.
 * @returns {number} quante foto sono finite fra i doppioni
 */
function segnaDoppioni() {
  const voci = stato.voci.filter((v) => v.analisi && !v.spostataIn);
  for (const v of voci) {
    delete v.doppioneDi;
    if (v.categoria === "doppioni" && !sceltaAMano(v)) categoriaDaiTag(v);
  }
  // Data di scatto dall'EXIF, altrimenti data del file
  const date = voci.map((v) => {
    const ms = v.dataScatto?.getTime() ?? v.dataFile;
    return ms == null ? null : ms / 1000;
  });
  let quante = 0;
  for (const gruppo of stato.analizzatore.doppioni(voci.map((v) => v.analisi), date)) {
    const migliore = voci[gruppo[0]];
    for (const i of gruppo.slice(1)) {
      const v = voci[i];
      v.doppioneDi = migliore.percorso;
      quante++;
      if (!sceltaAMano(v)) imposta(v, "doppioni", `doppione di ${migliore.handle.name}`);
    }
  }
  return quante;
}

/** Legge il file, lo decodifica una volta sola e ne ricava la provenienza. Non lancia mai: un errore finisce in .errore */
async function preparaSicura(voce) {
  try {
    const file = await voce.handle.getFile();
    const bitmap = await createImageBitmap(file).catch(() => null); // se non si decodifica qui, ci prova Eye dal file
    return { file, bitmap, ...(await provenienza(file, bitmap)) };
  } catch (errore) {
    return { errore };
  }
}

function formattaDurata(s) {
  if (!isFinite(s)) return "—";
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

// ---------- Risultati ----------

const analizzate = () => stato.voci.filter((v) => v.categoria);

/**
 * Tutti i conteggi che servono all'interfaccia, in un solo giro sulle foto.
 * perCategoria[id] = { totale, selezionate, daSpostare } (le spostate contano nel totale ma non nel resto).
 */
function riepilogo() {
  const perCategoria = {};
  let selezionate = 0;
  for (const v of stato.voci) {
    if (!v.categoria) continue;
    const c = (perCategoria[v.categoria] ??= { totale: 0, selezionate: 0, daSpostare: 0 });
    c.totale++;
    if (v.spostataIn) continue;
    c.daSpostare++;
    if (v.selezionata) {
      c.selezionate++;
      selezionate++;
    }
  }
  return { perCategoria, selezionate };
}

function disegnaSchede() {
  const r = riepilogo();
  const conteggi = Object.fromEntries(Object.entries(r.perCategoria).map(([id, c]) => [id, c.totale]));
  const presenti = CATEGORIE.filter((c) => conteggi[c.id]);
  if (!stato.scheda || !conteggi[stato.scheda]) {
    const scheda = presenti.find((c) => c.id !== "foto")?.id ?? presenti[0]?.id ?? null;
    if (scheda !== stato.scheda) {
      stato.scheda = scheda;
      stato.mostrate = PER_PAGINA;
      disegnaGriglia();
    }
  }

  const nav = $("schede");
  nav.replaceChildren(
    ...presenti.map((c) => {
      const b = document.createElement("button");
      b.className = "scheda";
      b.setAttribute("aria-selected", String(!stato.simili && c.id === stato.scheda));
      b.innerHTML = `${c.nome}<span class="conteggio">${conteggi[c.id].toLocaleString("it-IT")}</span>`;
      b.addEventListener("click", () => {
        chiudiSimili();
        stato.scheda = c.id;
        stato.mostrate = PER_PAGINA;
        disegnaSchede();
        disegnaGriglia();
      });
      return b;
    }),
  );
  aggiornaContatori(r);
}

function aggiornaContatori(r = riepilogo()) {
  $("btn-sposta").textContent = `Sposta selezionate (${r.selezionate.toLocaleString("it-IT")})`;
  $("btn-sposta").disabled = r.selezionate === 0;
  $("btn-sposta-categoria").hidden = !!stato.simili;
  if (stato.simili) {
    const visibili = vociSimili();
    const scelte = visibili.filter((v) => stato.simili.scelte.has(v)).length;
    $("testo-scheda").textContent = `${scelte} di ${visibili.length} foto simili scelte`;
    $("btn-simili-assegna").disabled = scelte === 0;
    return;
  }
  const scheda = r.perCategoria[stato.scheda] ?? { totale: 0, selezionate: 0, daSpostare: 0 };
  $("testo-scheda").textContent = stato.scheda
    ? `${scheda.selezionate} di ${scheda.totale} selezionate in "${PER_ID[stato.scheda].nome}"`
    : "";
  const daSpostareScheda = scheda.daSpostare;
  $("btn-sposta-categoria").hidden = !stato.scheda;
  $("btn-sposta-categoria").disabled = daSpostareScheda === 0;
  if (stato.scheda) {
    $("btn-sposta-categoria").textContent =
      `Sposta tutte le "${PER_ID[stato.scheda].nome}" (${daSpostareScheda.toLocaleString("it-IT")}) in ${NOME_USCITA}/${stato.scheda}`;
  }
}

const vociScheda = () => stato.voci.filter((v) => v.categoria === stato.scheda);

// Miniature: JPEG ridotto invece della foto intera, al massimo 4 in preparazione alla volta
// (decodificare decine di foto da 12 MP insieme blocca il browser).
const LATO_MINIATURA = 480;
const MINIATURE_IN_PARALLELO = 4;
const codaMiniature = [];
let miniatureInCorso = 0;

async function creaMiniatura(file) {
  const bmp = await createImageBitmap(file, { resizeWidth: LATO_MINIATURA, resizeQuality: "medium" });
  const tela = new OffscreenCanvas(bmp.width, bmp.height);
  tela.getContext("2d").drawImage(bmp, 0, 0);
  bmp.close();
  return tela.convertToBlob({ type: "image/jpeg", quality: 0.8 });
}

function prossimaMiniatura() {
  while (miniatureInCorso < MINIATURE_IN_PARALLELO && codaMiniature.length) {
    const tessera = codaMiniature.shift();
    if (!tessera.isConnected) continue; // la griglia è stata ridisegnata nel frattempo
    const voce = stato.voci[Number(tessera.dataset.indice)];
    if (voce.spostataIn) continue;
    miniatureInCorso++;
    voce.handle.getFile()
      .then((f) => creaMiniatura(f).catch(() => f)) // se non riesce a ridurla usa l'originale
      .then((blob) => {
        const img = tessera.querySelector("img");
        img.src = URL.createObjectURL(blob);
        img.onload = img.onerror = () => URL.revokeObjectURL(img.src);
      })
      .catch(() => {})
      .finally(() => {
        miniatureInCorso--;
        prossimaMiniatura();
      });
  }
}

// Le miniature si creano solo quando la tessera entra nello schermo
const osservatore = new IntersectionObserver(
  (entrate) => {
    for (const e of entrate) {
      if (!e.isIntersecting) continue;
      osservatore.unobserve(e.target);
      codaMiniature.push(e.target);
    }
    prossimaMiniatura();
  },
  { rootMargin: "300px" },
);

function disegnaGriglia() {
  const griglia = $("griglia");
  osservatore.disconnect();
  codaMiniature.length = 0;
  const voci = stato.simili ? vociSimili() : vociScheda();
  const visibili = voci.slice(0, stato.mostrate);
  griglia.replaceChildren(...visibili.map(creaTessera));
  aggiornaMostraAltre(voci.length);
  aggiornaContatori();
}

function aggiornaMostraAltre(quante) {
  $("btn-altre").hidden = quante <= stato.mostrate;
  $("btn-altre").textContent = `Mostra altre (${(quante - stato.mostrate).toLocaleString("it-IT")})`;
}

/**
 * Durante l'analisi: aggiunge in fondo alla griglia le foto appena finite nella scheda aperta,
 * senza ridisegnare (e ricaricare) le miniature già mostrate.
 */
function aggiungiNuoveTessere() {
  if (stato.simili) return; // la ricerca mostra una lista fissa, calcolata quando l'hai avviata
  const griglia = $("griglia");
  const voci = vociScheda();
  const mostrate = griglia.children.length;
  const ultima = griglia.lastElementChild;
  // Se la griglia non è più l'inizio della lista (es. categoria cambiata a mano) si ridisegna tutto
  if (mostrate && (mostrate > voci.length || Number(ultima.dataset.indice) !== voci[mostrate - 1].indice)) {
    return disegnaGriglia();
  }
  const nuove = voci.slice(mostrate, stato.mostrate);
  if (nuove.length) griglia.append(...nuove.map(creaTessera));
  aggiornaMostraAltre(voci.length);
}

$("btn-altre").addEventListener("click", () => {
  stato.mostrate += PER_PAGINA;
  disegnaGriglia();
});

function creaTessera(voce) {
  // Nella ricerca di simili la spunta vuol dire "scelta per la nuova categoria", non "da spostare"
  const simili = stato.simili;
  const spuntata = () => (simili ? simili.scelte.has(voce) : voce.selezionata);
  const t = document.createElement("div");
  t.className = "tessera" + (spuntata() ? " selezionata" : "") + (voce.spostataIn ? " spostata" : "");
  t.dataset.indice = voce.indice;
  t.title = voce.spostataIn ? `Spostata in ${voce.spostataIn}` : `${voce.percorso}\n${etichettaMotivo(voce)}`;
  t.innerHTML = `
    <img alt="" loading="lazy" />
    <span class="spunta-tessera">${spuntata() ? "✓" : ""}</span>
    <button class="info" type="button" aria-label="Dettagli">i</button>
    <span class="etichetta"></span>`;
  const nome = voce.spostataIn ? "Spostata" : voce.handle.name;
  t.querySelector(".etichetta").textContent = simili
    ? `${Math.round(simili.somiglianza.get(voce) * 100)}% · ${PER_ID[voce.categoria].nome} · ${nome}`
    : nome;
  t.addEventListener("click", (e) => {
    if (voce.spostataIn) return;
    if (e.target.closest(".info")) return apriDettaglio(voce);
    if (simili) {
      if (simili.scelte.has(voce)) simili.scelte.delete(voce);
      else simili.scelte.add(voce);
    } else {
      voce.selezionata = !voce.selezionata;
    }
    t.classList.toggle("selezionata", spuntata());
    t.querySelector(".spunta-tessera").textContent = spuntata() ? "✓" : "";
    aggiornaContatori();
  });
  osservatore.observe(t);
  return t;
}

function etichettaMotivo(voce) {
  return voce.motivo ? `Motivo: ${voce.motivo}` : "";
}

function selezionaScheda(valore) {
  if (stato.simili) {
    for (const v of vociSimili()) valore ? stato.simili.scelte.add(v) : stato.simili.scelte.delete(v);
  } else {
    for (const v of vociScheda()) if (!v.spostataIn) v.selezionata = valore;
  }
  disegnaGriglia();
}
$("btn-tutte").addEventListener("click", () => selezionaScheda(true));
$("btn-nessuna").addEventListener("click", () => selezionaScheda(false));

// ---------- Foto simili ----------
// Eye riassume ogni foto in 512 numeri (embedding): due foto che si somigliano hanno numeri vicini.
// Serve per ciò che il modello non ha come categoria, per esempio le lavagne d'ardesia col gesso.

const SOGLIA_SIMILI = 0.7;

/** Coseno fra due embedding (sono già di lunghezza 1): 1 = identiche, sotto 0,5 = poco in comune. */
function somiglianza(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Le foto della ricerca sopra la soglia scelta, dalla più simile. */
const vociSimili = () => stato.simili.ordinate.filter((v) => stato.simili.somiglianza.get(v) >= stato.simili.soglia);

function apriSimili(voce) {
  const rif = voce.analisi?.embedding;
  if (!rif) return;
  const somiglianze = new Map();
  for (const v of stato.voci) {
    if (v.analisi?.embedding && !v.spostataIn) somiglianze.set(v, somiglianza(rif, v.analisi.embedding));
  }
  const ordinate = [...somiglianze.keys()].sort((a, b) => somiglianze.get(b) - somiglianze.get(a));
  stato.simili = { voce, ordinate, somiglianza: somiglianze, soglia: SOGLIA_SIMILI, scelte: new Set(ordinate) };
  stato.mostrate = PER_PAGINA;
  $("simili-testo").textContent = `Foto simili a "${voce.handle.name}". La prima è lei; il numero su ogni foto dice quanto le somiglia.`;
  $("simili-soglia").value = Math.round(SOGLIA_SIMILI * 100);
  $("simili-valore").textContent = `${Math.round(SOGLIA_SIMILI * 100)}%`;
  $("simili-categoria").value = voce.categoria;
  $("pannello-simili").hidden = false;
  disegnaSchede();
  disegnaGriglia();
  $("pannello-simili").scrollIntoView({ behavior: "smooth", block: "start" });
}

function chiudiSimili() {
  if (!stato.simili) return;
  stato.simili = null;
  stato.mostrate = PER_PAGINA;
  $("pannello-simili").hidden = true;
}

$("simili-categoria").replaceChildren(
  ...CATEGORIE.map((c) => Object.assign(document.createElement("option"), { value: c.id, textContent: c.nome })),
);

$("simili-soglia").addEventListener("input", (e) => {
  stato.simili.soglia = Number(e.target.value) / 100;
  $("simili-valore").textContent = `${e.target.value}%`;
  stato.mostrate = PER_PAGINA;
  disegnaGriglia();
});

$("btn-simili-assegna").addEventListener("click", () => {
  const categoria = $("simili-categoria").value;
  const scelte = vociSimili().filter((v) => stato.simili.scelte.has(v));
  for (const v of scelte) imposta(v, categoria, `scelta a mano (simile a ${stato.simili.voce.handle.name})`);
  chiudiSimili();
  stato.scheda = categoria;
  disegnaSchede();
  disegnaGriglia();
  $("testo-scheda").textContent = `${scelte.length} foto messe in "${PER_ID[categoria].nome}". ` + $("testo-scheda").textContent;
});

$("btn-simili-chiudi").addEventListener("click", () => {
  chiudiSimili();
  disegnaSchede();
  disegnaGriglia();
});

// ---------- Dettaglio ----------

let vocePerDettaglio = null;
$("det-categoria").replaceChildren(
  ...CATEGORIE.map((c) => Object.assign(document.createElement("option"), { value: c.id, textContent: c.nome })),
);

async function apriDettaglio(voce) {
  vocePerDettaglio = voce;
  const file = await voce.handle.getFile();
  const img = $("det-img");
  img.src = URL.createObjectURL(file);
  img.onload = () => URL.revokeObjectURL(img.src);
  $("det-nome").textContent = voce.percorso;
  const prov = { fotocamera: "Scattata con la fotocamera", ricevuta: "Ricevuta o scaricata (nessun EXIF)", sticker: "Sticker" }[voce.provenienza] ?? "";
  $("det-provenienza").textContent = [prov, voce.dispositivo, voce.dataScatto?.toLocaleDateString("it-IT")].filter(Boolean).join(" · ");
  $("det-categoria").value = voce.categoria;
  $("det-selezionata").checked = !!voce.selezionata;
  $("det-simili").disabled = !voce.analisi?.embedding || !!voce.spostataIn;

  disegnaAnalisi(voce);
  $("dettaglio").showModal();
}

const crea = (tag, testo, classe) => Object.assign(document.createElement(tag), { textContent: testo, className: classe ?? "" });

/** Tutto ciò che Eye ha detto della foto: riepilogo, volti e tag divisi per famiglia. */
function disegnaAnalisi(voce) {
  const a = voce.analisi;
  const blocchi = [];
  const righe = righeAnalisi(a, voce.doppioneDi);
  if (righe.length) {
    const dl = crea("dl", "", "riepilogo");
    for (const [k, v] of righe) dl.append(crea("dt", k), crea("dd", v));
    blocchi.push(dl);
  }
  const volti = descriviVolti(a);
  if (volti.length) {
    const ul = crea("ul", "", "volti");
    ul.append(...volti.map((t) => crea("li", t)));
    blocchi.push(crea("h4", "Volto per volto"), ul);
  }
  for (const { famiglia, tag } of tagPerFamiglia(a?.confidences)) {
    const ul = crea("ul", "", "tag");
    ul.append(...tag.map(([t, c]) => crea("li", `${nomeTag(t)} ${Math.round(c * 100)}%`)));
    blocchi.push(crea("h4", famiglia.nome), ul);
  }
  if (!blocchi.length) blocchi.push(crea("p", voce.errore ? `Non leggibile: ${voce.errore}` : "Non ancora analizzata.", "nota"));
  $("det-analisi").replaceChildren(...blocchi);
}

$("det-categoria").addEventListener("change", (e) => {
  vocePerDettaglio.categoria = e.target.value;
  vocePerDettaglio.motivo = "scelta a mano";
});
$("det-simili").addEventListener("click", () => {
  const voce = vocePerDettaglio;
  $("dettaglio").close();
  apriSimili(voce);
});
$("det-selezionata").addEventListener("change", (e) => (vocePerDettaglio.selezionata = e.target.checked));
$("dettaglio").addEventListener("close", () => {
  disegnaSchede();
  disegnaGriglia();
});

// ---------- Spostamento ----------

/** Chiede conferma e sposta le voci date in _classificate/<categoria>. */
async function spostaVoci(daSpostare) {
  const perCategoria = {};
  for (const v of daSpostare) perCategoria[v.categoria] = (perCategoria[v.categoria] ?? 0) + 1;

  $("conf-testo").textContent = `${daSpostare.length.toLocaleString("it-IT")} foto verranno spostate in "${stato.radice.name}/${NOME_USCITA}":`;
  $("conf-elenco").replaceChildren(
    ...Object.entries(perCategoria).map(([c, n]) =>
      Object.assign(document.createElement("li"), { textContent: `${PER_ID[c].nome} → ${NOME_USCITA}/${c} (${n})` }),
    ),
  );
  if (stato.analizzatore.demo) {
    $("conf-testo").textContent = "Attenzione: sei in modalità demo e le categorie sono FINTE. " + $("conf-testo").textContent;
  }

  const dialogo = $("conferma");
  dialogo.showModal();
  const scelta = await new Promise((r) => dialogo.addEventListener("close", () => r(dialogo.returnValue), { once: true }));
  if (scelta !== "ok") return;

  if (!(await permessoScrittura(stato.radice))) {
    alert("Senza il permesso di scrittura non posso spostare i file.");
    return;
  }

  $("btn-sposta").disabled = true;
  $("btn-sposta-categoria").disabled = true;
  let fatte = 0;
  const errori = [];
  for (const v of daSpostare) {
    try {
      v.spostataIn = await sposta(stato.radice, v, v.categoria);
    } catch (err) {
      errori.push(`${v.percorso}: ${err.message}`);
    }
    fatte++;
    $("btn-sposta").textContent = `Sposto… ${fatte}/${daSpostare.length}`;
  }
  disegnaSchede();
  disegnaGriglia();
  alert(
    `Spostate ${(daSpostare.length - errori.length).toLocaleString("it-IT")} foto.` +
      (errori.length ? `\n\nNon spostate (${errori.length}):\n${errori.slice(0, 10).join("\n")}` : ""),
  );
}

$("btn-sposta").addEventListener("click", () => spostaVoci(analizzate().filter((v) => v.selezionata && !v.spostataIn)));

// Tutta la categoria aperta, selezionate o no, nella sua cartella
$("btn-sposta-categoria").addEventListener("click", () => spostaVoci(vociScheda().filter((v) => !v.spostataIn)));

// ---------- Report CSV ----------

$("btn-csv").addEventListener("click", () => {
  const csv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const righe = [[
    "file", "categoria", "motivo", "tipo", "provenienza", "dispositivo", "data_scatto_exif", "doppione_di",
    ...INTESTAZIONE_CSV, "spostata_in", "errore",
  ]];
  for (const v of stato.voci) {
    righe.push([
      v.percorso, v.categoria, v.motivo, v.analisi?.kind ? nomeTag(v.analisi.kind) : "", v.provenienza, v.dispositivo,
      v.dataScatto ? v.dataScatto.toISOString().slice(0, 10) : "", v.doppioneDi,
      ...colonneCsv(v.analisi), v.spostataIn, v.errore,
    ]);
  }
  const blob = new Blob(["﻿" + righe.map((r) => r.map(csv).join(";")).join("\r\n")], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "report-foto.csv" });
  a.click();
  URL.revokeObjectURL(a.href);
});

avviaModello();
