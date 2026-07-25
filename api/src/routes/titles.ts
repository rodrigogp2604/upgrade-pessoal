import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";

export const titlesRouter = Router();

// Escada de títulos personalizada (gerada pelo /briefing)
titlesRouter.get("/", async (_req, res) => {
  const titles = await prisma.title.findMany({ orderBy: { level: "asc" } });
  res.json(titles);
});

const putSchema = z.array(z.object({ level: z.number().int().min(1), name: z.string().min(1) })).min(1);

// Substitui a escada inteira de uma vez
titlesRouter.put("/", async (req, res) => {
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await prisma.$transaction([
    prisma.title.deleteMany(),
    prisma.title.createMany({ data: parsed.data }),
  ]);
  const titles = await prisma.title.findMany({ orderBy: { level: "asc" } });
  res.json(titles);
});
