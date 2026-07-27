import { prisma } from "../db";

// O pull do app usa `updatedAt` para descobrir o que mudou — e linha apagada não tem
// updatedAt. Por isso toda deleção deixa uma lápide aqui.
//
// Cascatas NÃO entram: apagar uma missão apaga as provas dentro do SQLite, sem passar
// pelo Prisma. O banco do app repete as mesmas FKs ON DELETE CASCADE, então o efeito
// se reproduz sozinho do outro lado.
export type TombstoneEntity = "week" | "mission" | "attachment" | "debt" | "payment" | "title";

export async function recordTombstone(entity: TombstoneEntity, entityId: number | string): Promise<void> {
  await prisma.tombstone.create({ data: { entity, entityId: String(entityId) } });
}
