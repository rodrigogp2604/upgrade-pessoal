// Fila de saída: toda ação do usuário entra aqui ANTES de existir rede.
//
// O `opId` é gerado no aparelho e nunca muda em reenvio — é a chave que faz o servidor
// reconhecer "já apliquei essa" e não creditar XP duas vezes. Se o app gerasse um id novo
// a cada tentativa, o retry viraria trapaça.
import type { SQLiteDatabase } from "expo-sqlite";
import * as Crypto from "expo-crypto";

export const OP_TYPES = [
  "mission.complete",
  "mission.uncomplete",
  "payment.create",
  "debt.create",
  "extra.add",
  "extra.remove",
  "setting.put",
  "visit.mark",
  "attachment.delete",
] as const;

export type OpType = (typeof OP_TYPES)[number];

/** O que o app viu no momento da ação. O servidor compara com o estado atual dele. */
export type OpBase = { updatedAt?: string | null; status?: string | null; value?: string | null };

export type OutboxRow = {
  opId: string;
  type: OpType;
  payload: string;
  base: string | null;
  status: "pending" | "conflict" | "discarded";
  tries: number;
  lastError: string | null;
  createdAt: string;
};

export const novoId = () => Crypto.randomUUID();

export async function enqueue(
  db: SQLiteDatabase,
  type: OpType,
  payload: Record<string, unknown>,
  base?: OpBase | null
): Promise<string> {
  const opId = novoId();
  await db.runAsync(
    "INSERT INTO outbox (opId, type, payload, base, status, tries, createdAt) VALUES (?, ?, ?, ?, 'pending', 0, ?)",
    opId,
    type,
    JSON.stringify(payload),
    base ? JSON.stringify(base) : null,
    new Date().toISOString()
  );
  return opId;
}

export async function pendingOps(db: SQLiteDatabase, limite = 25): Promise<OutboxRow[]> {
  return db.getAllAsync<OutboxRow>(
    "SELECT * FROM outbox WHERE status = 'pending' ORDER BY createdAt ASC, rowid ASC LIMIT ?",
    limite
  );
}

export async function markApplied(db: SQLiteDatabase, opId: string): Promise<void> {
  await db.runAsync("DELETE FROM outbox WHERE opId = ?", opId);
}

export async function markConflict(
  db: SQLiteDatabase,
  opId: string,
  info: { entity: string; entityId: string; reason: string; mineLabel: string; theirsLabel: string }
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE outbox SET status = 'conflict' WHERE opId = ?", opId);
    await db.runAsync(
      `INSERT INTO conflicts (opId, entity, entityId, reason, mineLabel, theirsLabel, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(opId) DO UPDATE SET
         reason = excluded.reason, mineLabel = excluded.mineLabel, theirsLabel = excluded.theirsLabel`,
      opId,
      info.entity,
      info.entityId,
      info.reason,
      info.mineLabel,
      info.theirsLabel,
      new Date().toISOString()
    );
  });
}

export async function markError(db: SQLiteDatabase, opId: string, erro: string): Promise<void> {
  await db.runAsync("UPDATE outbox SET tries = tries + 1, lastError = ? WHERE opId = ?", erro, opId);
}

/** Operação recusada pelo servidor por regra (arco fechado, missão apagada no PC…). */
export async function discard(db: SQLiteDatabase, opId: string, motivo: string): Promise<void> {
  await db.runAsync("UPDATE outbox SET status = 'discarded', lastError = ? WHERE opId = ?", motivo, opId);
}
