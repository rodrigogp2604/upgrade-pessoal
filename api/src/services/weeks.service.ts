// Arcos semanais. Tudo aqui é território do cowork: o app mobile só lê.
import { prisma } from "../db";
import { missionView } from "../lib/views";
import { playerView } from "../lib/player";
import { starBonusXp, levelFromXp } from "../domain";
import { AppError, notFound } from "../lib/errors";

type WeekWithStatuses = {
  id: number;
  floor: number;
  theme: string;
  startDate: string;
  status: string;
  rating: number | null;
  review: string | null;
  closedAt: Date | null;
  missions: { status: string }[];
};

export function weekSummary(w: WeekWithStatuses) {
  return {
    id: w.id,
    floor: w.floor,
    theme: w.theme,
    startDate: w.startDate,
    status: w.status,
    rating: w.rating,
    review: w.review,
    closedAt: w.closedAt,
    totalMissions: w.missions.length,
    doneMissions: w.missions.filter((m) => m.status === "done").length,
  };
}

const fullWeek = { missions: { orderBy: { order: "asc" }, include: { attachments: true } } } as const;

function weekDetail(w: {
  id: number; floor: number; theme: string; startDate: string; status: string;
  rating: number | null; review: string | null; closedAt: Date | null;
  missions: Parameters<typeof missionView>[0][];
}) {
  return {
    id: w.id,
    floor: w.floor,
    theme: w.theme,
    startDate: w.startDate,
    status: w.status,
    rating: w.rating,
    review: w.review,
    closedAt: w.closedAt,
    missions: w.missions.map(missionView),
  };
}

export async function listWeeks() {
  const weeks = await prisma.week.findMany({
    orderBy: { id: "desc" },
    include: { missions: { select: { status: true } } },
  });
  return weeks.map(weekSummary);
}

export async function getActiveWeek() {
  const week = await prisma.week.findFirst({
    where: { status: "active" },
    orderBy: { id: "desc" },
    include: fullWeek,
  });
  return week ? weekDetail(week) : null;
}

export async function getWeek(id: number) {
  const week = await prisma.week.findUnique({ where: { id }, include: fullWeek });
  if (!week) throw notFound("arco não encontrado");
  return weekDetail(week);
}

export type WeekInput = {
  theme: string;
  startDate: string;
  floor?: number;
  missions: {
    title: string;
    description?: string | null;
    bonus?: string | null;
    xp: number;
    statGains: Record<string, number>;
  }[];
};

export async function createWeek(input: WeekInput) {
  const active = await prisma.week.findFirst({ where: { status: "active" } });
  if (active) {
    throw new AppError("week_active", "feche o arco atual antes de abrir outro", 409, { activeWeekId: active.id });
  }

  const char = await prisma.character.findUniqueOrThrow({ where: { id: 1 } });
  const floor = input.floor ?? levelFromXp(char.xp);

  const week = await prisma.week.create({
    data: {
      floor,
      theme: input.theme,
      startDate: input.startDate,
      status: "active",
      missions: {
        create: input.missions.map((m, i) => ({
          order: i + 1,
          title: m.title,
          description: m.description ?? null,
          bonus: m.bonus ?? null,
          xp: m.xp,
          statGains: JSON.stringify(m.statGains),
        })),
      },
    },
    include: fullWeek,
  });

  return weekDetail(week);
}

export type CloseWeekInput = {
  rating: number;
  review?: string | null;
  missionRatings: { missionId: number; stars: number }[];
};

// Fecha o arco com a revisão de domingo (estrelas → bônus de XP).
export async function closeWeek(id: number, input: CloseWeekInput) {
  const week = await prisma.week.findUnique({ where: { id } });
  if (!week) throw notFound("arco não encontrado");
  if (week.status === "closed") throw new AppError("already_closed", "arco já fechado", 400);

  let bonusXp = 0;
  for (const mr of input.missionRatings) {
    bonusXp += starBonusXp(mr.stars);
    await prisma.mission.update({ where: { id: mr.missionId }, data: { rating: mr.stars } });
  }

  const char = await prisma.character.findUniqueOrThrow({ where: { id: 1 } });
  const oldLevel = levelFromXp(char.xp);
  const newXp = char.xp + bonusXp;

  await prisma.$transaction([
    prisma.week.update({
      where: { id },
      data: { status: "closed", rating: input.rating, review: input.review ?? null, closedAt: new Date() },
    }),
    prisma.character.update({ where: { id: 1 }, data: { xp: newXp } }),
  ]);

  return {
    weekId: id,
    bonusXp,
    leveledUp: levelFromXp(newXp) > oldLevel,
    newLevel: levelFromXp(newXp),
    character: await playerView(),
  };
}
