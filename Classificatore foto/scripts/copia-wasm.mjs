// Copia il runtime WebAssembly di LiteRT dentro public/, così l'app funziona
// anche senza internet invece di scaricarlo ogni volta da jsDelivr.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origine = path.join(radice, "node_modules", "@litertjs", "core", "wasm");
const destinazione = path.join(radice, "public", "litert-wasm");

try {
  await fs.mkdir(destinazione, { recursive: true });
  for (const nome of await fs.readdir(origine)) {
    await fs.copyFile(path.join(origine, nome), path.join(destinazione, nome));
  }
  console.log("Runtime LiteRT copiato in public/litert-wasm");
} catch (err) {
  console.warn("Impossibile copiare il runtime LiteRT:", err.message);
}
