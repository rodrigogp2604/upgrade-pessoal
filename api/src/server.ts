import path from "node:path";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import { characterRouter } from "./routes/character";
import { missionsRouter } from "./routes/missions";
import { weeksRouter } from "./routes/weeks";
import { debtsRouter } from "./routes/debts";
import { attachmentsRouter } from "./routes/attachments";
import { settingsRouter } from "./routes/settings";
import { briefingRouter } from "./routes/briefing";
import { titlesRouter } from "./routes/titles";
import { syncRouter } from "./routes/sync";
import { appRouter } from "./routes/app";
import { errorHandler } from "./lib/http";
import { repairLegacyDateTimes } from "./lib/repair-datetimes";

export function createApp() {
  const app = express();
  app.use(cors());
  // 2mb (o padrão é 100kb): o avatar é um data URL dentro do JSON. O painel já reduz a
  // foto para 256px, mas não quero que "escolhi a foto errada" vire erro 413.
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/character", characterRouter);
  app.use("/api/missions", missionsRouter);
  app.use("/api/weeks", weeksRouter);
  app.use("/api/debts", debtsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/briefing", briefingRouter);
  app.use("/api/titles", titlesRouter);
  app.use("/api/sync", syncRouter);
  app.use("/api/app", appRouter);
  app.use("/api", attachmentsRouter); // /api/missions/:id/attachments e /api/attachments/:id/*

  // Referência da API (página estática, sem build). Fica antes do catch-all do painel,
  // senão o SPA responderia /docs com o index.html dele.
  // `../docs` resolve tanto de src/ (dev, via tsx) quanto de dist/ (produção).
  app.use("/docs", express.static(path.resolve(__dirname, "../docs")));

  // Em produção, serve o frontend buildado (api/public)
  const publicDir = path.resolve(__dirname, "../public");
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    // O navegador pede /favicon.ico sozinho, sem olhar o <link> da página; sem esta linha
    // o catch-all abaixo devolveria o HTML do painel como se fosse um ícone.
    app.get("/favicon.ico", (_req, res) => res.sendFile(path.join(publicDir, "torre.ico")));
    app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
  }

  // por último: traduz AppError dos services em status + json
  app.use(errorHandler);

  return app;
}

const PORT = Number(process.env.PORT) || 4000;

// Quando executado direto (dev via tsx), sobe o servidor.
if (require.main === module) {
  repairLegacyDateTimes()
    .catch((e) => console.error("aviso: não consegui normalizar as datas —", e))
    .finally(() => {
      createApp().listen(PORT, () => {
        console.log(`🎮 Upgrade Pessoal API em http://localhost:${PORT}`);
      });
    });
}
