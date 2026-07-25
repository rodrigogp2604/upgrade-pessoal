import { prisma } from "../db";

export function isoDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// Registra o check-in de hoje (idempotente).
export async function recordVisit(): Promise<void> {
  const date = isoDay();
  await prisma.visit.upsert({
    where: { date },
    update: {},
    create: { date },
  });
}

// Streak = dias consecutivos com check-in terminando hoje.
export async function currentStreak(): Promise<number> {
  const rows = await prisma.visit.findMany({ select: { date: true } });
  const set = new Set(rows.map((r) => r.date));
  let n = 0;
  const cursor = new Date();
  while (set.has(isoDay(cursor))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}
