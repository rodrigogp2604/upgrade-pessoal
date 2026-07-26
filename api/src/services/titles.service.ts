import { prisma } from "../db";
import { recordTombstone } from "../lib/tombstones";

export type TitleInput = { level: number; name: string };

export async function listTitles() {
  return prisma.title.findMany({ orderBy: { level: "asc" } });
}

// Substitui a escada inteira de uma vez (o /briefing regera do zero).
// Os ids antigos morrem aqui, então cada um deixa lápide — senão o app ficaria com a
// escada velha e a nova empilhadas.
export async function replaceLadder(items: TitleInput[]) {
  const old = await prisma.title.findMany({ select: { id: true } });

  await prisma.$transaction([prisma.title.deleteMany(), prisma.title.createMany({ data: items })]);

  for (const t of old) await recordTombstone("title", t.id);

  return listTitles();
}
