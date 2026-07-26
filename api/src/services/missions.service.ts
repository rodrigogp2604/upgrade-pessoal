// Regras de missão — fonte única para a rota HTTP (painel) e para o push do sync (celular).
// Se o cálculo de XP morasse dentro do handler, o app e o painel poderiam divergir.
import { prisma } from "../db";
import { missionView, safeJson } from "../lib/views";
import { playerView } from "../lib/player";
import { levelFromXp } from "../domain";
import { AppError, notFound } from "../lib/errors";
import { recordTombstone } from "../lib/tombstones";

export type MissionInput = {
  weekId?: number;
  title: string;
  description?: string | null;
  bonus?: string | null;
  xp: number;
  statGains: Record<string, number>;
};

const withAttachments = { attachments: true } as const;

async function findMissionOrThrow(id: number) {
  const mission = await prisma.mission.findUnique({ where: { id }, include: withAttachments });
  if (!mission) throw notFound("missão não encontrada");
  return mission;
}

// O arco fechado é história: nem o painel nem o celular mexem em missão dele.
// Quem reabre a conversa é o ritual de domingo, não um toque na tela.
async function assertWeekOpen(weekId: number) {
  const week = await prisma.week.findUnique({ where: { id: weekId }, select: { status: true } });
  if (week?.status === "closed") {
    throw new AppError("week_closed", "este arco já foi fechado — fale com o cowork", 409);
  }
}

export async function createMission(input: MissionInput) {
  let targetWeek = input.weekId;
  if (!targetWeek) {
    const active = await prisma.week.findFirst({ where: { status: "active" }, orderBy: { id: "desc" } });
    if (!active) throw new AppError("not_found", "nenhum arco ativo", 400);
    targetWeek = active.id;
  }
  await assertWeekOpen(targetWeek);

  const count = await prisma.mission.count({ where: { weekId: targetWeek } });
  const mission = await prisma.mission.create({
    data: {
      weekId: targetWeek,
      order: count + 1,
      title: input.title,
      description: input.description ?? null,
      bonus: input.bonus ?? null,
      xp: input.xp,
      statGains: JSON.stringify(input.statGains),
    },
    include: withAttachments,
  });
  return missionView(mission);
}

export async function updateMission(id: number, patch: Partial<MissionInput>) {
  await findMissionOrThrow(id);
  const mission = await prisma.mission.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.bonus !== undefined ? { bonus: patch.bonus } : {}),
      ...(patch.xp !== undefined ? { xp: patch.xp } : {}),
      ...(patch.statGains !== undefined ? { statGains: JSON.stringify(patch.statGains) } : {}),
    },
    include: withAttachments,
  });
  return missionView(mission);
}

export async function deleteMission(id: number) {
  await findMissionOrThrow(id);
  await prisma.mission.delete({ where: { id } });
  // as provas somem por cascata no SQLite — o app repete a cascata local
  await recordTombstone("mission", id);
}

export type CompleteResult = {
  mission: ReturnType<typeof missionView>;
  character: Awaited<ReturnType<typeof playerView>>;
  leveledUp: boolean;
  newLevel: number;
  gainedXp: number;
  gains: Record<string, number>;
};

// Concluir quest → concede XP + atributos, detecta level-up.
// Idempotente de propósito: concluir de novo não credita XP outra vez. É a segunda
// linha de defesa contra o push repetido do celular (a primeira é a tabela SyncOp).
export async function completeMission(id: number): Promise<CompleteResult> {
  const m = await findMissionOrThrow(id);
  await assertWeekOpen(m.weekId);

  const char = await prisma.character.findUniqueOrThrow({ where: { id: 1 } });

  if (m.status === "done") {
    return {
      mission: missionView(m),
      character: await playerView(),
      leveledUp: false,
      newLevel: levelFromXp(char.xp),
      gainedXp: 0,
      gains: {},
    };
  }

  const stats = safeJson<Record<string, number>>(char.stats, {});
  const gains = safeJson<Record<string, number>>(m.statGains, {});
  for (const [k, v] of Object.entries(gains)) stats[k] = Math.min(100, (stats[k] ?? 0) + v);
  const oldLevel = levelFromXp(char.xp);
  const newXp = char.xp + m.xp;

  await prisma.$transaction([
    prisma.character.update({ where: { id: 1 }, data: { xp: newXp, stats: JSON.stringify(stats) } }),
    prisma.mission.update({ where: { id }, data: { status: "done", completedAt: new Date() } }),
  ]);

  const updated = await findMissionOrThrow(id);
  const newLevel = levelFromXp(newXp);
  return {
    mission: missionView(updated),
    character: await playerView(),
    leveledUp: newLevel > oldLevel,
    newLevel,
    gainedXp: m.xp,
    gains,
  };
}

// Desfazer conclusão (reverte XP + atributos).
export async function uncompleteMission(id: number) {
  const m = await findMissionOrThrow(id);
  await assertWeekOpen(m.weekId);
  if (m.status !== "done") throw new AppError("invalid_payload", "missão não está concluída", 400);

  const char = await prisma.character.findUniqueOrThrow({ where: { id: 1 } });
  const stats = safeJson<Record<string, number>>(char.stats, {});
  const gains = safeJson<Record<string, number>>(m.statGains, {});
  for (const [k, v] of Object.entries(gains)) stats[k] = Math.max(0, (stats[k] ?? 0) - v);
  const newXp = Math.max(0, char.xp - m.xp);

  await prisma.$transaction([
    prisma.character.update({ where: { id: 1 }, data: { xp: newXp, stats: JSON.stringify(stats) } }),
    prisma.mission.update({ where: { id }, data: { status: "pending", completedAt: null } }),
  ]);

  return { mission: missionView(await findMissionOrThrow(id)), character: await playerView() };
}
