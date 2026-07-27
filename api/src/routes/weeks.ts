import { Router } from "express";
import { z } from "zod";
import { route } from "../lib/http";
import { closeWeek, createWeek, getActiveWeek, getWeek, listWeeks } from "../services/weeks.service";

export const weeksRouter = Router();

// lista todos os arcos (histórico)
weeksRouter.get(
  "/",
  route(async (_req, res) => {
    res.json(await listWeeks());
  })
);

// arco ativo com missões completas
weeksRouter.get(
  "/active",
  route(async (_req, res) => {
    res.json(await getActiveWeek());
  })
);

// detalhe de um arco
weeksRouter.get(
  "/:id",
  route(async (req, res) => {
    res.json(await getWeek(Number(req.params.id)));
  })
);

const createSchema = z.object({
  theme: z.string().min(1),
  startDate: z.string().min(8),
  floor: z.number().int().optional(),
  missions: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().optional().nullable(),
        bonus: z.string().optional().nullable(),
        xp: z.number().int().min(0).default(0),
        statGains: z.record(z.string(), z.number()).default({}),
        kind: z.enum(["main", "side"]).optional(),
      })
    )
    .default([]),
});

// cria novo arco (domingo). Exige que o anterior esteja fechado.
weeksRouter.post(
  "/",
  route(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.status(201).json(await createWeek(parsed.data));
  })
);

const closeSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().optional().nullable(),
  missionRatings: z
    .array(z.object({ missionId: z.number().int(), stars: z.number().int().min(1).max(5) }))
    .default([]),
});

// fecha o arco com a revisão de domingo (estrelas → bônus de XP)
weeksRouter.post(
  "/:id/close",
  route(async (req, res) => {
    const parsed = closeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await closeWeek(Number(req.params.id), parsed.data));
  })
);
