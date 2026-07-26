// Leitura: transforma as tabelas locais no formato que as telas já consomem.
import type { SQLiteDatabase } from "expo-sqlite";
import type { Attachment, Debt, Extra, GameData, Mission, Title, Week } from "@/game/types";

const json = <T>(raw: string | null | undefined, padrao: T): T => {
  if (!raw) return padrao;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return padrao;
  }
};

type LinhaMissao = {
  id: number; weekId: number; order: number; title: string;
  description: string | null; bonus: string | null; xp: number;
  statGains: string; status: string; rating: number | null; kind: string | null;
};

type LinhaDebt = { id: number; name: string; note: string | null; kind: string; total: number; status: string };

export async function loadGameData(db: SQLiteDatabase): Promise<GameData | null> {
  const character = await db.getFirstAsync<{ name: string; xp: number; stats: string }>(
    "SELECT name, xp, stats FROM character WHERE id = 1"
  );
  // sem personagem = aparelho ainda não sincronizou nada
  if (!character) return null;

  const [titles, weeks, missoes, anexos, dividas, pagamentos, configs, visitas] = await Promise.all([
    db.getAllAsync<Title>("SELECT id, level, name FROM titles ORDER BY level ASC"),
    db.getAllAsync<Week>(
      "SELECT id, floor, theme, startDate, status, rating, review FROM weeks ORDER BY floor DESC"
    ),
    db.getAllAsync<LinhaMissao>(
      `SELECT id, weekId, "order", title, description, bonus, xp, statGains, status, rating, kind
         FROM missions ORDER BY weekId DESC, "order" ASC`
    ),
    db.getAllAsync<Attachment>("SELECT id, missionId, originalName, url FROM attachments ORDER BY id ASC"),
    db.getAllAsync<LinhaDebt>('SELECT id, name, note, kind, total, status FROM debts ORDER BY "order" ASC'),
    db.getAllAsync<{ debtId: number; amount: number }>("SELECT debtId, amount FROM payments"),
    db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM settings"),
    db.getAllAsync<{ date: string }>("SELECT date FROM visits ORDER BY date DESC"),
  ]);

  const settings: Record<string, string> = {};
  for (const c of configs) settings[c.key] = c.value;

  const pagoPorDivida = new Map<number, number>();
  for (const p of pagamentos) pagoPorDivida.set(p.debtId, (pagoPorDivida.get(p.debtId) ?? 0) + p.amount);

  const debts: Debt[] = dividas.map((d) => ({
    id: d.id,
    name: d.name,
    note: d.note,
    kind: d.kind === "item" ? "item" : "debt",
    total: d.total,
    paid: pagoPorDivida.get(d.id) ?? 0,
    status: d.status === "dead" ? "dead" : "active",
  }));

  const missions: Mission[] = missoes.map((m) => ({
    id: m.id,
    weekId: m.weekId,
    order: m.order,
    title: m.title,
    description: m.description,
    bonus: m.bonus,
    xp: m.xp,
    statGains: json<Record<string, number>>(m.statGains, {}),
    status: m.status === "done" ? "done" : "pending",
    rating: m.rating,
    kind: m.kind === "side" ? "side" : "main",
  }));

  return {
    character: { name: character.name, xp: character.xp, stats: json<Record<string, number>>(character.stats, {}) },
    titles,
    weeks: weeks.map((w) => ({ ...w, status: w.status === "closed" ? "closed" : "active" })),
    missions,
    attachments: anexos,
    debts,
    extras: json<Extra[]>(settings.extras ?? "[]", []).filter((e) => e && typeof e.value === "number"),
    settings,
    streak: streakDe(visitas.map((v) => v.date)),
  };
}

// Mesma regra do servidor (api/src/lib/streak.ts): dias consecutivos terminando hoje.
export function streakDe(datas: string[]): number {
  const conjunto = new Set(datas);
  let n = 0;
  const cursor = new Date();
  while (conjunto.has(cursor.toISOString().slice(0, 10))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

export async function getSyncState(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>("SELECT value FROM sync_state WHERE key = ?", key);
  return row?.value ?? null;
}

export async function setSyncState(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    "INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value
  );
}

export async function countPending(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE status = 'pending'");
  return row?.n ?? 0;
}

export async function countConflicts(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM conflicts");
  return row?.n ?? 0;
}
