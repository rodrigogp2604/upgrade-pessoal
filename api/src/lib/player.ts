import { prisma } from "../db";
import { characterView } from "./views";
import { currentStreak } from "./streak";

// Personagem completo: streak + escada de títulos personalizada (tabela Title).
export async function playerView() {
  const char = await prisma.character.findUnique({ where: { id: 1 } });
  if (!char) return null;
  const [streak, ladder] = await Promise.all([
    currentStreak(),
    prisma.title.findMany({ orderBy: { level: "asc" } }),
  ]);
  return characterView(char, streak, ladder);
}
