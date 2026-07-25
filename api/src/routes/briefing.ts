import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";

export const briefingRouter = Router();

// Briefing ativo (a revisão mais recente). null = onboarding pendente.
briefingRouter.get("/", async (_req, res) => {
  const latest = await prisma.briefing.findFirst({ orderBy: { id: "desc" } });
  const versions = await prisma.briefing.count();
  res.json(latest ? { id: latest.id, content: latest.content, createdAt: latest.createdAt, versions } : null);
});

// Histórico de revisões (metadados; o conteúdo sai no GET /:id)
briefingRouter.get("/history", async (_req, res) => {
  const all = await prisma.briefing.findMany({ orderBy: { id: "desc" }, select: { id: true, createdAt: true } });
  res.json(all);
});

briefingRouter.get("/:id", async (req, res) => {
  const b = await prisma.briefing.findUnique({ where: { id: Number(req.params.id) } });
  if (!b) return res.status(404).json({ error: "briefing não encontrado" });
  res.json(b);
});

const postSchema = z.object({ content: z.string().min(1) });

// Nova versão do briefing (escrita pelo cowork na entrevista / revisão de domingo)
briefingRouter.post("/", async (req, res) => {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const b = await prisma.briefing.create({ data: { content: parsed.data.content } });
  res.status(201).json(b);
});
