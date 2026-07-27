// Escrita: cada ação faz DUAS coisas na mesma transação —
//   1. muda o espelho local (a tela responde na hora, offline);
//   2. enfileira a operação na outbox (o PC descobre depois).
//
// A ordem importa: se o app morrer entre uma coisa e outra, ficaria um XP que ninguém
// pediu ou um pedido que a tela não mostra. Transação resolve.
import type { SQLiteDatabase } from "expo-sqlite";
import * as Crypto from "expo-crypto";
import { enqueue } from "./outbox";
import { levelFromXp } from "@/domain";

const agora = () => new Date().toISOString();
const hoje = () => agora().slice(0, 10);

type LinhaMissao = {
  id: number; xp: number; statGains: string; status: string; updatedAt: string | null; weekId: number;
};

export type ResultadoConclusao = { gainedXp: number; leveledUp: boolean; newLevel: number };

/** Conclui a missão localmente (XP + atributos) e enfileira `mission.complete`. */
export async function completeMissionLocal(db: SQLiteDatabase, missionId: number): Promise<ResultadoConclusao | null> {
  const m = await db.getFirstAsync<LinhaMissao>(
    "SELECT id, xp, statGains, status, updatedAt, weekId FROM missions WHERE id = ?",
    missionId
  );
  if (!m || m.status === "done") return null;

  const semana = await db.getFirstAsync<{ status: string }>("SELECT status FROM weeks WHERE id = ?", m.weekId);
  if (semana?.status === "closed") return null; // arco fechado é história (mesma regra do servidor)

  const char = await db.getFirstAsync<{ xp: number; stats: string }>("SELECT xp, stats FROM character WHERE id = 1");
  if (!char) return null;

  const stats: Record<string, number> = safe(char.stats);
  const ganhos: Record<string, number> = safe(m.statGains);
  for (const [k, v] of Object.entries(ganhos)) stats[k] = Math.min(100, (stats[k] ?? 0) + v);

  const xpNovo = char.xp + m.xp;
  const subiu = levelFromXp(xpNovo) > levelFromXp(char.xp);

  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE character SET xp = ?, stats = ? WHERE id = 1", xpNovo, JSON.stringify(stats));
    await db.runAsync("UPDATE missions SET status = 'done', completedAt = ? WHERE id = ?", agora(), missionId);
    await enqueue(db, "mission.complete", { missionId }, { updatedAt: m.updatedAt, status: m.status });
  });

  return { gainedXp: m.xp, leveledUp: subiu, newLevel: levelFromXp(xpNovo) };
}

/** Desfaz a conclusão (reverte XP + atributos) e enfileira `mission.uncomplete`. */
export async function uncompleteMissionLocal(db: SQLiteDatabase, missionId: number): Promise<boolean> {
  const m = await db.getFirstAsync<LinhaMissao>(
    "SELECT id, xp, statGains, status, updatedAt, weekId FROM missions WHERE id = ?",
    missionId
  );
  if (!m || m.status !== "done") return false;

  const char = await db.getFirstAsync<{ xp: number; stats: string }>("SELECT xp, stats FROM character WHERE id = 1");
  if (!char) return false;

  const stats: Record<string, number> = safe(char.stats);
  const ganhos: Record<string, number> = safe(m.statGains);
  for (const [k, v] of Object.entries(ganhos)) stats[k] = Math.max(0, (stats[k] ?? 0) - v);

  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE character SET xp = ?, stats = ? WHERE id = 1", Math.max(0, char.xp - m.xp), JSON.stringify(stats));
    await db.runAsync("UPDATE missions SET status = 'pending', completedAt = NULL WHERE id = ?", missionId);
    await enqueue(db, "mission.uncomplete", { missionId }, { updatedAt: m.updatedAt, status: m.status });
  });

  return true;
}

/** Ataca o chefão: cria o pagamento local com `clientUuid` (a chave anti-duplicata). */
export async function payDebtLocal(db: SQLiteDatabase, debtId: number, amount: number, note?: string): Promise<boolean> {
  const d = await db.getFirstAsync<{ id: number; total: number }>("SELECT id, total FROM debts WHERE id = ?", debtId);
  if (!d || !(amount > 0)) return false;

  const clientUuid = Crypto.randomUUID();
  // id negativo: linha que só existe aqui até o pull trazer a versão do servidor.
  // Assim ela não colide com nenhum id real e é fácil de reconhecer.
  const idLocal = await proximoIdLocal(db, "payments");

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT INTO payments (id, debtId, amount, note, date, clientUuid) VALUES (?, ?, ?, ?, ?, ?)",
      idLocal,
      debtId,
      amount,
      note ?? null,
      agora(),
      clientUuid
    );
    const pago = await db.getFirstAsync<{ soma: number }>(
      "SELECT COALESCE(SUM(amount), 0) AS soma FROM payments WHERE debtId = ?",
      debtId
    );
    if ((pago?.soma ?? 0) >= d.total) {
      await db.runAsync("UPDATE debts SET status = 'dead' WHERE id = ?", debtId);
    }
    await enqueue(db, "payment.create", { debtId, amount, note: note ?? null, clientUuid });
  });

  return true;
}

/** Cria um chefão novo pelo celular (a única entidade que o app pode criar). */
export async function createDebtLocal(
  db: SQLiteDatabase,
  entrada: { name: string; total: number; kind?: "debt" | "item"; note?: string }
): Promise<boolean> {
  if (!entrada.name.trim() || !(entrada.total > 0)) return false;
  const idLocal = await proximoIdLocal(db, "debts");

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO debts (id, name, note, kind, total, status, "order") VALUES (?, ?, ?, ?, ?, \'active\', 999)',
      idLocal,
      entrada.name.trim(),
      entrada.note ?? null,
      entrada.kind ?? "debt",
      entrada.total
    );
    await enqueue(db, "debt.create", {
      name: entrada.name.trim(),
      total: entrada.total,
      kind: entrada.kind ?? "debt",
      note: entrada.note ?? null,
      // campo interno (sai antes de ir para a rede): liga o id provisório ao id real que
      // o servidor devolver, para um pagamento feito offline nesse chefão achar o dono.
      _localId: idLocal,
    });
  });

  return true;
}

/** Freela: cada um nasce com uuid, então celular e PC nunca conflitam nessa lista. */
export async function addExtraLocal(db: SQLiteDatabase, name: string, value: number): Promise<boolean> {
  if (!name.trim() || !(value > 0)) return false;
  const id = Crypto.randomUUID();
  const lista = safe<{ id: string; name: string; value: number; at?: string }[]>(
    (await getSetting(db, "extras")) ?? "[]",
    []
  );
  const novo = { id, name: name.trim(), value, at: agora() };

  await db.withTransactionAsync(async () => {
    await gravarSetting(db, "extras", JSON.stringify([...lista, novo]));
    await enqueue(db, "extra.add", novo);
  });

  return true;
}

export async function removeExtraLocal(db: SQLiteDatabase, id: string): Promise<void> {
  const lista = safe<{ id: string }[]>((await getSetting(db, "extras")) ?? "[]", []);
  await db.withTransactionAsync(async () => {
    await gravarSetting(db, "extras", JSON.stringify(lista.filter((e) => e.id !== id)));
    await enqueue(db, "extra.remove", { id });
  });
}

/** Só as keys que o servidor aceita do celular (o resto é do painel/cowork). */
export const KEYS_DO_APP = ["income_current", "pouch", "pouch_goal", "avatar"] as const;
export type KeyDoApp = (typeof KEYS_DO_APP)[number];

export async function putSettingLocal(db: SQLiteDatabase, key: KeyDoApp, value: string): Promise<void> {
  const anterior = await db.getFirstAsync<{ updatedAt: string | null }>(
    "SELECT updatedAt FROM settings WHERE key = ?",
    key
  );

  await db.withTransactionAsync(async () => {
    await gravarSetting(db, key, value);
    await enqueue(db, "setting.put", { key, value }, { updatedAt: anterior?.updatedAt ?? null });
  });
}

/** Check-in do dia. Idempotente: abrir o app dez vezes não muda nada. */
export async function markVisitLocal(db: SQLiteDatabase): Promise<void> {
  const dia = hoje();
  const existe = await db.getFirstAsync<{ date: string }>("SELECT date FROM visits WHERE date = ?", dia);
  if (existe) return;

  await db.withTransactionAsync(async () => {
    await db.runAsync("INSERT OR IGNORE INTO visits (date) VALUES (?)", dia);
    await enqueue(db, "visit.mark", { date: dia });
  });
}

/**
 * Desfaz, sem enfileirar nada, o efeito local de uma operação que o servidor recusou.
 *
 * Só trata o que CRIA linha: um chefão ou pagamento inventado offline e recusado ficaria
 * no celular para sempre, porque o pull nunca vai trazer algo que o PC não tem. Mudanças
 * de estado (missão concluída, valor de setting) o pull completo conserta sozinho.
 */
export async function reverterCriacaoLocal(db: SQLiteDatabase, type: string, payload: Record<string, unknown>): Promise<void> {
  if (type === "debt.create" && typeof payload._localId === "number") {
    await db.runAsync("DELETE FROM debts WHERE id = ?", payload._localId as number);
    return;
  }

  if (type === "payment.create" && typeof payload.clientUuid === "string") {
    const pagamento = await db.getFirstAsync<{ debtId: number }>(
      "SELECT debtId FROM payments WHERE clientUuid = ?",
      payload.clientUuid as string
    );
    await db.runAsync("DELETE FROM payments WHERE clientUuid = ?", payload.clientUuid as string);
    // o chefão pode ter sido dado como derrotado por causa desse pagamento
    if (pagamento) {
      const d = await db.getFirstAsync<{ total: number }>("SELECT total FROM debts WHERE id = ?", pagamento.debtId);
      const pago = await db.getFirstAsync<{ soma: number }>(
        "SELECT COALESCE(SUM(amount), 0) AS soma FROM payments WHERE debtId = ?",
        pagamento.debtId
      );
      if (d && (pago?.soma ?? 0) < d.total) {
        await db.runAsync("UPDATE debts SET status = 'active' WHERE id = ?", pagamento.debtId);
      }
    }
  }
}

// ── apoio ──

function safe<T>(raw: string, padrao: T = [] as unknown as T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return padrao;
  }
}

async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  return row?.value ?? null;
}

async function gravarSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value
  );
}

// Linhas criadas no celular ganham id negativo decrescente: nunca colidem com os ids do
// servidor (positivos) e o pull depois substitui pela linha verdadeira.
async function proximoIdLocal(db: SQLiteDatabase, tabela: "payments" | "debts"): Promise<number> {
  const row = await db.getFirstAsync<{ menor: number | null }>(`SELECT MIN(id) AS menor FROM ${tabela}`);
  const menor = row?.menor ?? 0;
  return Math.min(menor, 0) - 1;
}
