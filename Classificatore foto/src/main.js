import { CATEGORIE, PER_ID, NON_SPOSTARE_DI_DEFAULT, assegnaCategoria } from "./categorie.js";
import { modelloPresente, caricaEye, caricaDemo, provenienza } from "./analizzatore.js";
import { supportato, scegliCartella, permessoScrittura, elencaImmagini, sposta, NOME_USCITA } from "./cartella.js";

const $ = (id) => document.getElementById(id);
const PER_PAGINA = 120;

const stato = {
  analizzatore: null,
  radice: null,
  /** @type {Array<{handle, cartella, percorso, provenienza?, dispositivo?, dataScatto?, analisi?, categoria?, motivo?, selezionata?, spostataIn?, errore?}>} */
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
  $("testo-cartella").textContent = `Cerco le immagini in "${stato.radice.name}"…`;
  stato.voci = await elencaImmagini(stato.radice, { sottocartelle: $("chk-sottocartelle").checked });
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
  stato.fermato = false;
  $("btn-analizza").disabled = true;
  $("btn-cartella").disabled = true;
  $("passo-analisi").hidden = false;
  $("btn-ferma").hidden = false;
  $("risultati").hidden = false;
  stato.scheda = null;

  const totale = stato.voci.length;
  const inizio = performance.now();
  let ultimoRender = 0;

  for (let i = 0; i < totale && !stato.fermato; i++) {
    const voce = stato.voci[i];
    if (voce.analisi || voce.spostataIn) continue;
    try {
      const file = await voce.handle.getFile();
      Object.assign(voce, await provenienza(file));
      voce.analisi = await stato.analizzatore.analizza(file);
      const { categoria, motivo } = assegnaCategoria(voce.analisi, voce.provenienza);
      voce.categoria = categoria;
      voce.motivo = motivo;
      voce.selezionata = !NON_SPOSTARE_DI_DEFAULT.has(categoria);
    } catch (err) {
      voce.errore = String(err.message ?? err);
    }

    const fatte = i + 1;
    $("barra-analisi").firstElementChild.style.width = `${(fatte / totale) * 100}%`;
    const secondi = (performance.now() - inizio) / 1000;
    const rimanenti = Math.round((secondi / fatte) * (totale - fatte));
    $("testo-analisi").textContent =
      `${fatte.toLocaleString("it-IT")} di ${totale.toLocaleString("it-IT")} · circa ${formattaDurata(rimanenti)} rimanenti`;
    if (performance.now() - ultimoRender > 700) {
      ultimoRender = performance.now();
      disegnaSchede();
    }
  }

  const errori = stato.voci.filter((v) => v.errore).length;
  $("testo-analisi").textContent =
    (stato.fermato ? "Analisi fermata. " : "Analisi completata. ") +
    `${stato.voci.filter((v) => v.analisi).length.toLocaleString("it-IT")} immagini analizzate` +
    (errori ? `, ${errori} non leggibili.` : ".");
  $("btn-ferma").hidden = true;
  $("btn-cartella").disabled = false;
  $("btn-analizza").disabled = !stato.voci.some((v) => !v.analisi && !v.spostataIn && !v.errore);
  $("btn-analizza").textContent = $("btn-analizza").disabled ? "Avvia analisi" : "Riprendi analisi";
  disegnaSchede();
  disegnaGriglia();
}

function formattaDurata(s) {
  if (!isFinite(s)) return "—";
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

// ---------- Risultati ----------

const analizzate = () => stato.voci.filter((v) => v.categoria);

function disegnaSchede() {
  const conteggi = {};
  for (const v of analizzate()) conteggi[v.categoria] = (conteggi[v.categoria] ?? 0) + 1;
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
      b.setAttribute("aria-selected", String(c.id === stato.scheda));
      b.innerHTML = `${c.nome}<span class="conteggio">${conteggi[c.id].toLocaleString("it-IT")}</span>`;
      b.addEventListener("click", () => {
        stato.scheda = c.id;
        stato.mostrate = PER_PAGINA;
        disegnaSchede();
        disegnaGriglia();
      });
      return b;
    }),
  );
  aggiornaContatori();
}

function aggiornaContatori() {
  const daSpostare = analizzate().filter((v) => v.selezionata && !v.spostataIn).length;
  $("btn-sposta").textContent = `Sposta selezionate (${daSpostare.toLocaleString("it-IT")})`;
  $("btn-sposta").disabled = daSpostare === 0;
  const nellaScheda = vociScheda();
  const sel = nellaScheda.filter((v) => v.selezionata && !v.spostataIn).length;
  $("testo-scheda").textContent = stato.scheda
    ? `${sel} di ${nellaScheda.length} selezionate in "${PER_ID[stato.scheda].nome}"`
    : "";
}

const vociScheda = () => analizzate().filter((v) => v.categoria === stato.scheda);

// Le miniature si creano solo quando la tessera entra nello schermo
const osservatore = new IntersectionObserver(
  (entrate) => {
    for (const e of entrate) {
      if (!e.isIntersecting) continue;
      osservatore.unobserve(e.target);
      const voce = stato.voci[Number(e.target.dataset.indice)];
      if (voce.spostataIn) continue;
      voce.handle.getFile().then((f) => {
        const img = e.target.querySelector("img");
        img.src = URL.createObjectURL(f);
        img.onload = () => URL.revokeObjectURL(img.src);
      }).catch(() => {});
    }
  },
  { rootMargin: "300px" },
);

function disegnaGriglia() {
  const griglia = $("griglia");
  osservatore.disconnect();
  const voci = vociScheda();
  const visibili = voci.slice(0, stato.mostrate);
  griglia.replaceChildren(...visibili.map(creaTessera));
  $("btn-altre").hidden = voci.length <= stato.mostrate;
  $("btn-altre").textContent = `Mostra altre (${(voci.length - stato.mostrate).toLocaleString("it-IT")})`;
  aggiornaContatori();
}

$("btn-altre").addEventListener("click", () => {
  stato.mostrate += PER_PAGINA;
  disegnaGriglia();
});

function creaTessera(voce) {
  const indice = stato.voci.indexOf(voce);
  const t = document.createElement("div");
  t.className = "tessera" + (voce.selezionata ? " selezionata" : "") + (voce.spostataIn ? " spostata" : "");
  t.dataset.indice = indice;
  t.title = voce.spostataIn ? `Spostata in ${voce.spostataIn}` : `${voce.percorso}\n${etichettaMotivo(voce)}`;
  t.innerHTML = `
    <img alt="" loading="lazy" />
    <span class="spunta-tessera">${voce.selezionata ? "✓" : ""}</span>
    <button class="info" type="button" aria-label="Dettagli">i</button>
    <span class="etichetta"></span>`;
  t.querySelector(".etichetta").textContent = voce.spostataIn ? "Spostata" : voce.handle.name;
  t.addEventListener("click", (e) => {
    if (voce.spostataIn) return;
    if (e.target.closest(".info")) return apriDettaglio(voce);
    voce.selezionata = !voce.selezionata;
    t.classList.toggle("selezionata", voce.selezionata);
    t.querySelector(".spunta-tessera").textContent = voce.selezionata ? "✓" : "";
    aggiornaContatori();
  });
  osservatore.observe(t);
  return t;
}

function etichettaMotivo(voce) {
  return voce.motivo ? `Motivo: ${voce.motivo}` : "";
}

function selezionaScheda(valore) {
  for (const v of vociScheda()) if (!v.spostataIn) v.selezionata = valore;
  disegnaGriglia();
}
$("btn-tutte").addEventListener("click", () => selezionaScheda(true));
$("btn-nessuna").addEventListener("click", () => selezionaScheda(false));

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

  const conf = voce.analisi?.confidences ?? {};
  const tag = Object.entries(conf).filter(([, c]) => c >= 0.5).sort((a, b) => b[1] - a[1]).slice(0, 20);
  $("det-tag").replaceChildren(
    ...tag.map(([t, c]) => Object.assign(document.createElement("li"), { textContent: `${t} ${Math.round(c * 100)}%` })),
  );
  $("dettaglio").showModal();
}

$("det-categoria").addEventListener("change", (e) => {
  vocePerDettaglio.categoria = e.target.value;
  vocePerDettaglio.motivo = "scelta a mano";
});
$("det-selezionata").addEventListener("change", (e) => (vocePerDettaglio.selezionata = e.target.checked));
$("dettaglio").addEventListener("close", () => {
  disegnaSchede();
  disegnaGriglia();
});

// ---------- Spostamento ----------

$("btn-sposta").addEventListener("click", async () => {
  const daSpostare = analizzate().filter((v) => v.selezionata && !v.spostataIn);
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
});

// ---------- Report CSV ----------

$("btn-csv").addEventListener("click", () => {
  const csv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const righe = [["file", "categoria", "motivo", "tipo", "provenienza", "dispositivo", "data_scatto_exif", "tag", "spostata_in", "errore"]];
  for (const v of stato.voci) {
    const tag = v.analisi ? Object.entries(v.analisi.confidences ?? {}).filter(([, c]) => c >= 0.5).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t).join(" ") : "";
    righe.push([
      v.percorso, v.categoria, v.motivo, v.analisi?.kind, v.provenienza, v.dispositivo,
      v.dataScatto ? v.dataScatto.toISOString().slice(0, 10) : "", tag, v.spostataIn, v.errore,
    ]);
  }
  const blob = new Blob(["﻿" + righe.map((r) => r.map(csv).join(";")).join("\r\n")], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "report-foto.csv" });
  a.click();
  URL.revokeObjectURL(a.href);
});

avviaModello();
