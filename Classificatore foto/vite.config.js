import { defineConfig } from "vite";

// COOP/COEP abilitano il cross-origin isolation, che serve alla versione
// multi-thread del runtime LiteRT (più veloce sulla CPU quando manca WebGPU).
const isolamento = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  server: { headers: isolamento, open: true },
  preview: { headers: isolamento, open: true },
  optimizeDeps: {
    // L'SDK carica il proprio .wasm con import.meta.url: non va pre-impacchettato.
    exclude: ["@desert-ant-labs/eye", "@desert-ant-labs/core", "@litertjs/core"],
  },
  build: { target: "es2022" },
});
