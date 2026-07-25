import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { missionView, safeJson } from "../lib/views";
import { playerView } from "../lib/player";
import { levelFromXp } from "../domain";

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
missionsRouter.post("/", async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { weekId, title, description, bonus, xp, statGains } = parsed.data;

  let targetWeek = weekId;
  if (!targetWeek) {
    const active = await prisma.week.findFirst({ where: { status: "active" }, orderBy: { id: "desc" } });
    if (!active) return res.status(400).json({ error: "nenhum arco ativo" });
    targetWeek = active.id;
  }
  const count = await prisma.mission.count({ where: { weekId: targetWeek } });
  const mission = await prisma.mission.create({
    data: {
      weekId: targetWeek,
      order: count + 1,
      title,
      description: description ?? null,
      bonus: bonus ?? null,
      xp,
      statGains: JSON.stringify(statGains),
    },
    include: { attachments: true },
  });
  res.status(201).json(missionView(mission));
});

missionsRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = upsertSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const mission = await prisma.mission.update({
    where: { id },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.description !== undefined ? { description: d.description } : {}),
      ...(d.bonus !== undefined ? { bonus: d.bonus } : {}),
      ...(d.xp !== undefined ? { xp: d.xp } : {}),
      ...(d.statGains !== undefined ? { statGains: JSON.stringify(d.statGains) } : {}),
    },
    include: { attachments: true },
  });
  res.json(missionView(mission));
});

missionsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.mission.delete({ where: { id } });
  res.status(204).end();
});

// completar quest → concede XP + atributos, detecta level-up
missionsRouter.post("/:id/complete", async (req, res) => {
  const id = Number(req.params.id);
  const m = await prisma.mission.findUnique({ where: { id }, include: { attachments: true } });
  if (!m) return res.status(404).json({ error: "missão não encontrada" });

  const char = await prisma.character.findUniqueOrThrow({ where: { id: 1 } });
  const already = m.status === "done";

  if (!already) {
    const stats = safeJson<Record<string, number>>(char.stats, {});
    const gains = safeJson<Record<string, number>>(m.statGains, {});
    for (const [k, v] of Object.entries(gains)) stats[k] = Math.min(100, (stats[k] ?? 0) + v);
    const oldLevel = levelFromXp(char.xp);
    const newXp = char.xp + m.xp;

    await prisma.$transaction([
      prisma.character.update({ where: { id: 1 }, data: { xp: newXp, stats: JSON.stringify(stats) } }),
      prisma.mission.update({ where: { id }, data: { status: "done", completedAt: new Date() } }),
    ]);

    const updatedMission = await prisma.mission.findUniqueOrThrow({ where: { id }, include: { attachments: true } });
    const newLevel = levelFromXp(newXp);
    return res.json({
      mission: missionView(updatedMission),
      character: await playerView(),
      leveledUp: newLevel > oldLevel,
      newLevel,
      gainedXp: m.xp,
      gains: safeJson<Record<string, number>>(m.statGains, {}),
    });
  }

  res.json({
    mission: missionView(m),
    character: await playerView(),
    leveledUp: false,
    newLevel: levelFromXp(char.xp),
    gainedXp: 0,
    gains: {},
  });
});

// desfazer conclusão (reverte XP + atributos)
missionsRouter.post("/:id/uncomplete", async (req, res) => {
  const id = Number(req.params.id);
  const m = await prisma.mission.findUnique({ where: { id }, include: { attachments: true } });
  if (!m) return res.status(404).json({ error: "missão não encontrada" });
  if (m.status !== "done") return res.status(400).json({ error: "missão não está concluída" });

  const char = await prisma.character.findUniqueOrThrow({ where: { id: 1 } });
  const stats = safeJson<Record<string, number>>(char.stats, {});
  const gains = safeJson<Record<string, number>>(m.statGains, {});
  for (const [k, v] of Object.entries(gains)) stats[k] = Math.max(0, (stats[k] ?? 0) - v);
  const newXp = Math.max(0, char.xp - m.xp);

  await prisma.$transaction([
    prisma.character.update({ where: { id: 1 }, data: { xp: newXp, stats: JSON.stringify(stats) } }),
    prisma.mission.update({ where: { id }, data: { status: "pending", completedAt: null } }),
  ]);

  const updatedMission = await prisma.mission.findUniqueOrThrow({ where: { id }, include: { attachments: true } });
  res.json({ mission: missionView(updatedMission), character: await playerView() });
});
