import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // O ícone da Torre (o mesmo do app e do atalho) mora em assets/ e é servido na raiz:
  // apontar a publicDir para lá evita manter uma segunda cópia dentro do web/.
  publicDir: "../assets",
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
      // a referência da API é estática e mora na API — sem isso ela só existiria na :4000
      "/docs": "http://localhost:4000",
    },
  },
  build: {
    outDir: "dist",
  },
});
