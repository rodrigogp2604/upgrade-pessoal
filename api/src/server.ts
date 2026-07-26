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
import { errorHandler } from "./lib/http";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/character", characterRouter);
  app.use("/api/missions", missionsRouter);
  app.use("/api/weeks", weeksRouter);
  app.use("/api/debts", debtsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/briefing", briefingRouter);
  app.use("/api/titles", titlesRouter);
  app.use("/api", attachmentsRouter); // /api/missions/:id/attachments e /api/attachments/:id/*

  // Em produção, serve o frontend buildado (api/public)
  const publicDir = path.resolve(__dirname, "../public");
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
  }

  // por último: traduz AppError dos services em status + json
  app.use(errorHandler);

  return app;
}

const PORT = Number(process.env.PORT) || 4000;

// Quando executado direto (dev via tsx), sobe o servidor.
if (require.main === module) {
  createApp().listen(PORT, () => {
    console.log(`🎮 Upgrade Pessoal API em http://localhost:${PORT}`);
  });
}
