// ⚠️ ESPELHO de api/src/domain.ts — se um mudar, o outro muda no mesmo commit.
//
// Existe porque o app precisa celebrar o XP na hora, sem rede. O servidor continua sendo
// a verdade: no primeiro pull os valores dele sobrescrevem os locais.

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

export function xpForLevel(level: number): number {
  return Math.max(0, (level - 1) * XP_PER_LEVEL);
}

export function titleFor(level: number, ladder: { level: number; name: string }[]): string | null {
  let title: string | null = null;
  for (const t of [...ladder].sort((a, b) => a.level - b.level)) {
    if (level >= t.level) title = t.name;
  }
  return title;
}

export function nextTitle(level: number, ladder: { level: number; name: string }[]) {
  for (const t of [...ladder].sort((a, b) => a.level - b.level)) {
    if (level < t.level) return t;
  }
  return null;
}

export function starBonusXp(stars: number): number {
  const table: Record<number, number> = { 1: 0, 2: 10, 3: 25, 4: 45, 5: 70 };
  return table[stars] ?? 0;
}

export function progressWithinLevel(xp: number) {
  const into = xp % XP_PER_LEVEL;
  return { into, needed: XP_PER_LEVEL, pct: Math.round((into / XP_PER_LEVEL) * 100) };
}

// Poder total = soma dos atributos (o mesmo cálculo de lib/views.ts na API).
export function powerFromStats(stats: Record<string, number>): number {
  return Math.round(Object.values(stats).reduce((a, b) => a + b, 0));
}
