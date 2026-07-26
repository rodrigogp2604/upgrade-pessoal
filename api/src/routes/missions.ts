import { Router } from "express";
import { z } from "zod";
import { route } from "../lib/http";
import {
  completeMission,
  createMission,
  deleteMission,
  uncompleteMission,
  updateMission,
} from "../services/missions.service";

export const missionsRouter = Router();

const upsertSchema = z.object({
  weekId: z.number().int().optional(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  bonus: z.string().optional().nullable(),
  xp: z.number().int().min(0).default(0),
  statGains: z.record(z.string(), z.number()).default({}),
});

// cria missão avulsa em um arco (ex.: "esqueci de adicionar")
missionsRouter.post(
  "/",
  route(async (req, res) => {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.status(201).json(await createMission(parsed.data));
  })
);

missionsRouter.patch(
  "/:id",
  route(async (req, res) => {
    const parsed = upsertSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await updateMission(Number(req.params.id), parsed.data));
  })
);

missionsRouter.delete(
  "/:id",
  route(async (req, res) => {
    await deleteMission(Number(req.params.id));
    res.status(204).end();
  })
);

// completar quest → concede XP + atributos, detecta level-up
missionsRouter.post(
  "/:id/complete",
  route(async (req, res) => {
    res.json(await completeMission(Number(req.params.id)));
  })
);

// desfazer conclusão (reverte XP + atributos)
missionsRouter.post(
  "/:id/uncomplete",
  route(async (req, res) => {
    res.json(await uncompleteMission(Number(req.params.id)));
  })
);
