import { prisma } from "./db";

// Sem dados fixos: o banco nasce só com o personagem vazio (id 1).
// Quem preenche tudo — nome, andar inicial, atributos, títulos, metas,
// chefões e o primeiro arco — é a entrevista do /briefing com o cowork.
export async function seedIfEmpty() {
  const count = await prisma.character.count();
  if (count > 0) return false;
  await prisma.character.create({ data: { id: 1, name: "Jogador", xp: 0, stats: "{}" } });
  return true;
}
