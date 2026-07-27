import { Router } from "express";
import { z } from "zod";
import { route } from "../lib/http";
import { calibrateCharacter, getPlayer } from "../services/character.service";
import { markVisit } from "../services/visits.service";

export const characterRouter = Router();

characterRouter.get(
  "/",
  route(async (_req, res) => {
    await markVisit();
    res.json(await getPlayer());
  })
);

// Calibragem do personagem — usada pelo /briefing (avaliação profissional).
// `floor` define o andar inicial (vira XP base); `stats` substitui os atributos.
const putSchema = z.object({
  name: z.string().min(1).optional(),
  xp: z.number().int().min(0).optional(),
  floor: z.number().int().min(1).optional(),
  stats: z.record(z.string(), z.number().min(0).max(100)).optional(),
});

characterRouter.put(
  "/",
  route(async (req, res) => {
    const parsed = putSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await calibrateCharacter(parsed.data));
  })
);
