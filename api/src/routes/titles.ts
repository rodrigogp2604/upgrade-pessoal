import { Router } from "express";
import { z } from "zod";
import { route } from "../lib/http";
import { listTitles, replaceLadder } from "../services/titles.service";

export const titlesRouter = Router();

// Escada de títulos personalizada (gerada pelo /briefing)
titlesRouter.get(
  "/",
  route(async (_req, res) => {
    res.json(await listTitles());
  })
);

const putSchema = z.array(z.object({ level: z.number().int().min(1), name: z.string().min(1) })).min(1);

// Substitui a escada inteira de uma vez
titlesRouter.put(
  "/",
  route(async (req, res) => {
    const parsed = putSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await replaceLadder(parsed.data));
  })
);
