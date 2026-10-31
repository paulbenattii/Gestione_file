// Accesso alla cartella scelta dall'utente (File System Access API, Chrome ed Edge).
// L'app non cancella mai nulla: sposta soltanto, dentro "_classificate".

export const NOME_USCITA = "_classificate";
const ESTENSIONI = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;

export const supportato = () => "showDirectoryPicker" in window;

export async function scegliCartella() {
  return window.showDirectoryPicker({ id: "riordina-foto", mode: "readwrite" });
}

/** Chiede (di nuovo) il permesso di scrittura, necessario per spostare i file. */
export async function permessoScrittura(cartella) {
  const opz = { mode: "readwrite" };
  if ((await cartella.queryPermission(opz)) === "granted") return true;
  return (await cartella.requestPermission(opz)) === "granted";
}

/**
 * Elenca le immagini. Restituisce { handle, cartella, percorso } per ognuna.
 * @param {FileSystemDirectoryHandle} radice
 * @param {{ sottocartelle: boolean }} opzioni
 */
export async function elencaImmagini(radice, { sottocartelle }) {
  const trovate = [];
  async function visita(dir, prefisso) {
    for await (const voce of dir.values()) {
      if (voce.kind === "directory") {
        if (sottocartelle && voce.name !== NOME_USCITA) await visita(voce, `${prefisso}${voce.name}/`);
      } else if (ESTENSIONI.test(voce.name)) {
        trovate.push({ handle: voce, cartella: dir, percorso: prefisso + voce.name });
      }
    }
  }
  await visita(radice, "");
  trovate.sort((a, b) => a.percorso.localeCompare(b.percorso, "it", { numeric: true }));
  return trovate;
}

async function esiste(dir, nome) {
  try {
    await dir.getFileHandle(nome);
    return true;
  } catch {
    return false;
  }
}

async function nomeLibero(dir, nome) {
  if (!(await esiste(dir, nome))) return nome;
  const punto = nome.lastIndexOf(".");
  const base = punto > 0 ? nome.slice(0, punto) : nome;
  const est = punto > 0 ? nome.slice(punto) : "";
  for (let i = 1; ; i++) {
    const candidato = `${base}-${i}${est}`;
    if (!(await esiste(dir, candidato))) return candidato;
  }
}

/**
 * Sposta un file in <radice>/_classificate/<categoria>/.
 * Usa move() quando il browser lo supporta (mantiene la data di modifica);
 * altrimenti copia, verifica la dimensione e solo allora rimuove l'originale.
 * @returns {Promise<string>} il nuovo percorso relativo
 */
export async function sposta(radice, voce, categoria) {
  const uscita = await radice.getDirectoryHandle(NOME_USCITA, { create: true });
  const dest = await uscita.getDirectoryHandle(categoria, { create: true });
  const nome = await nomeLibero(dest, voce.handle.name);

  if (typeof voce.handle.move === "function") {
    try {
      await voce.handle.move(dest, nome);
      return `${NOME_USCITA}/${categoria}/${nome}`;
    } catch {
      /* move() non disponibile per questo file: si passa alla copia */
    }
  }

  const originale = await voce.handle.getFile();
  const nuovo = await dest.getFileHandle(nome, { create: true });
  const scrittura = await nuovo.createWritable();
  await scrittura.write(originale);
  await scrittura.close();
  const verifica = await nuovo.getFile();
  if (verifica.size !== originale.size) {
    await dest.removeEntry(nome);
    throw new Error("copia incompleta, originale lasciato al suo posto");
  }
  await voce.cartella.removeEntry(voce.handle.name);
  return `${NOME_USCITA}/${categoria}/${nome}`;
}
