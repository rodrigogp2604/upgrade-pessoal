import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { missionView } from "../lib/views";
import { playerView } from "../lib/player";
import { starBonusXp, levelFromXp } from "../domain";

export const weeksRouter = Router();

function weekSummary(w: {
  id: number; floor: number; theme: string; startDate: string;
  status: string; rating: number | null; review: string | null; closedAt: Date | null;
  missions: { status: string }[];
}) {
  const total = w.missions.length;
  const done = w.missions.filter((m) => m.status === "done").length;
  return {
    id: w.id, floor: w.floor, theme: w.theme, startDate: w.startDate,
    status: w.status, rating: w.rating, review: w.review, closedAt: w.closedAt,
    totalMissions: total, doneMissions: done,
  };
}

// lista todos os arcos (histórico)
weeksRouter.get("/", async (_req, res) => {
  const weeks = await prisma.week.findMany({
    orderBy: { id: "desc" },
    include: { missions: { select: { status: true } } },
  });
  res.json(weeks.map(weekSummary));
});

// arco ativo com missões completas
weeksRouter.get("/active", async (_req, res) => {
  const week = await prisma.week.findFirst({
    where: { status: "active" },
    orderBy: { id: "desc" },
    include: { missions: { orderBy: { order: "asc" }, include: { attachments: true } } },
  });
  if (!week) return res.json(null);
  res.json({
    id: week.id, floor: week.floor, theme: week.theme, startDate: week.startDate,
    status: week.status, rating: week.rating, review: week.review, closedAt: week.closedAt,
    missions: week.missions.map(missionView),
  });
});

// detalhe de um arco
weeksRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const week = await prisma.week.findUnique({
    where: { id },
    include: { missions: { orderBy: { order: "asc" }, include: { attachments: true } } },
  });
  if (!week) return res.status(404).json({ error: "arco não encontrado" });
  res.json({
    id: week.id, floor: week.floor, theme: week.theme, startDate: week.startDate,
    status: week.status, rating: week.rating, review: week.review, closedAt: week.closedAt,
    missions: week.missions.map(missionView),
  });
});

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
      })
    )
    .default([]),
});

// cria novo arco (domingo). Exige que o anterior esteja fechado.
weeksRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const active = await prisma.week.findFirst({ where: { status: "active" } });
  if (active) return res.status(409).json({ error: "feche o arco atual antes de abrir outro", activeWeekId: active.id });

  const char = await prisma.character.findUniqueOrThrow({ where: { id: 1 } });
  const floor = parsed.data.floor ?? levelFromXp(char.xp);

  const week = await prisma.week.create({
    data: {
      floor,
      theme: parsed.data.theme,
      startDate: parsed.data.startDate,
      status: "active",
      missions: {
        create: parsed.data.missions.map((m, i) => ({
          order: i + 1,
          title: m.title,
          description: m.description ?? null,
          bonus: m.bonus ?? null,
          xp: m.xp,
          statGains: JSON.stringify(m.statGains),
        })),
      },
    },
    include: { missions: { orderBy: { order: "asc" }, include: { attachments: true } } },
  });

  res.status(201).json({
    id: week.id, floor: week.floor, theme: week.theme, startDate: week.startDate,
    status: week.status, missions: week.missions.map(missionView),
  });
});

const closeSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().optional().nullable(),
  missionRatings: z.array(z.object({ missionId: z.number().int(), stars: z.number().int().min(1).max(5) })).default([]),
});

// fecha o arco com a revisão de domingo (estrelas → bônus de XP)
weeksRouter.post("/:id/close", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = closeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { rating, review, missionRatings } = parsed.data;

  const week = await prisma.week.findUnique({ where: { id } });
  if (!week) return res.status(404).json({ error: "arco não encontrado" });
  if (week.status === "closed") return res.status(400).json({ error: "arco já fechado" });

  let bonusXp = 0;
  for (const mr of missionRatings) {
    bonusXp += starBonusXp(mr.stars);
    await prisma.mission.update({ where: { id: mr.missionId }, data: { rating: mr.stars } });
  }

  const char = await prisma.character.findUniqueOrThrow({ where: { id: 1 } });
  const oldLevel = levelFromXp(char.xp);
  const newXp = char.xp + bonusXp;

  await prisma.$transaction([
    prisma.week.update({ where: { id }, data: { status: "closed", rating, review: review ?? null, closedAt: new Date() } }),
    prisma.character.update({ where: { id: 1 }, data: { xp: newXp } }),
  ]);

  res.json({
    weekId: id,
    bonusXp,
    leveledUp: levelFromXp(newXp) > oldLevel,
    newLevel: levelFromXp(newXp),
    character: await playerView(),
  });
});
