import { prisma } from "../db";
import { playerView } from "../lib/player";
import { syncFinancialHealth } from "../lib/finance";
import { xpForLevel } from "../domain";
import { notFound } from "../lib/errors";

export async function getPlayer() {
  const view = await playerView();
  if (!view) throw notFound("personagem não encontrado");
  return view;
}

export type CalibrateInput = {
  name?: string;
  xp?: number;
  floor?: number;
  stats?: Record<string, number>;
};

// Calibragem do personagem — usada pelo /briefing (avaliação profissional).
// `floor` define o andar inicial (vira XP base); `stats` substitui os atributos.
export async function calibrateCharacter(input: CalibrateInput) {
  const xp = input.xp ?? (input.floor !== undefined ? xpForLevel(input.floor) : undefined);

  await prisma.character.upsert({
    where: { id: 1 },
    update: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(xp !== undefined ? { xp } : {}),
      ...(input.stats !== undefined ? { stats: JSON.stringify(input.stats) } : {}),
    },
    create: {
      id: 1,
      name: input.name ?? "Jogador",
      xp: xp ?? 0,
      stats: JSON.stringify(input.stats ?? {}),
    },
  });
  await syncFinancialHealth();
  return getPlayer();
}
