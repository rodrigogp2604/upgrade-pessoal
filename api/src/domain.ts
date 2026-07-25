// Regras do jogo — fonte única da verdade (o front só exibe o que a API calcula).
// Dados pessoais (título, atributos iniciais, andar inicial) NÃO vivem aqui:
// são definidos pelo /briefing e gravados no banco.

export const XP_PER_LEVEL = 100;

export const STAT_KEYS = [
  "Renda",
  "Presença Digital",
  "Marca Pessoal",
  "Domínio Técnico",
  "Networking",
  "Saúde Financeira",
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

export function levelFromXp(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

// Andar da Torre (estilo SAO): 1 andar por nível.
export function floorFromXp(xp: number): number {
  return levelFromXp(xp);
}

// XP base para começar num andar avaliado pelo briefing (andar 50 → 4900 XP).
export function xpForLevel(level: number): number {
  return Math.max(0, (level - 1) * XP_PER_LEVEL);
}

// Título vem da escada personalizada (tabela Title), gerada pelo briefing.
export function titleFor(level: number, ladder: { level: number; name: string }[]): string | null {
  let title: string | null = null;
  for (const t of [...ladder].sort((a, b) => a.level - b.level)) {
    if (level >= t.level) title = t.name;
  }
  return title;
}

export function nextTitle(level: number, ladder: { level: number; name: string }[]): { level: number; name: string } | null {
  for (const t of [...ladder].sort((a, b) => a.level - b.level)) {
    if (level < t.level) return t;
  }
  return null;
}

// Bônus de XP na revisão de domingo, conforme as estrelas (1-5).
export function starBonusXp(stars: number): number {
  const table: Record<number, number> = { 1: 0, 2: 10, 3: 25, 4: 45, 5: 70 };
  return table[stars] ?? 0;
}

export function progressWithinLevel(xp: number) {
  const into = xp % XP_PER_LEVEL;
  return { into, needed: XP_PER_LEVEL, pct: Math.round((into / XP_PER_LEVEL) * 100) };
}
