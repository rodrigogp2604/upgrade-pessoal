import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { recordVisit } from "../lib/streak";
import { playerView } from "../lib/player";
import { syncFinancialHealth } from "../lib/finance";
import { xpForLevel } from "../domain";

export const characterRouter = Router();

characterRouter.get("/", async (_req, res) => {
  await recordVisit();
  const view = await playerView();
  if (!view) return res.status(404).json({ error: "personagem não encontrado" });
  res.json(view);
});

// Calibragem do personagem — usada pelo /briefing (avaliação profissional).
// `floor` define o andar inicial (vira XP base); `stats` substitui os atributos.
const putSchema = z.object({
  name: z.string().min(1).optional(),
  xp: z.number().int().min(0).optional(),
  floor: z.number().int().min(1).optional(),
  stats: z.record(z.string(), z.number().min(0).max(100)).optional(),
});

characterRouter.put("/", async (req, res) => {
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const xp = d.xp ?? (d.floor !== undefined ? xpForLevel(d.floor) : undefined);
  await prisma.character.upsert({
    where: { id: 1 },
    update: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(xp !== undefined ? { xp } : {}),
      ...(d.stats !== undefined ? { stats: JSON.stringify(d.stats) } : {}),
    },
    create: {
      id: 1,
      name: d.name ?? "Jogador",
      xp: xp ?? 0,
      stats: JSON.stringify(d.stats ?? {}),
    },
  });
  await syncFinancialHealth();
  res.json(await playerView());
});
