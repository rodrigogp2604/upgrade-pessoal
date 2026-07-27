// Resolução de conflitos: as duas saídas possíveis quando celular e PC discordam.
//
//   "usar celular" → a mesma operação volta para a fila com `force`, e o servidor aplica
//                    ignorando a comparação. O opId é derivado (…#force) porque o original
//                    já foi respondido — reusar o id faria o servidor devolver a resposta
//                    guardada em vez de aplicar.
//
//   "usar PC"      → a operação é descartada e o app pede um pull COMPLETO. Só descartar
//                    não bastaria: o espelho local ainda tem a versão do celular, e o pull
//                    incremental não traria a linha de volta (no PC nada mudou).
import type { SQLiteDatabase } from "expo-sqlite";
import { setSyncState } from "./repo";
import { reverterCriacaoLocal } from "./mutations";

export type Conflito = {
  opId: string;
  entity: string;
  entityId: string;
  reason: string;
  mineLabel: string;
  theirsLabel: string;
  createdAt: string;
};

export type Lado = "celular" | "pc";

export async function listarConflitos(db: SQLiteDatabase): Promise<Conflito[]> {
  return db.getAllAsync<Conflito>("SELECT * FROM conflicts ORDER BY createdAt ASC");
}

export async function resolver(db: SQLiteDatabase, opId: string, lado: Lado): Promise<void> {
  const original = await db.getFirstAsync<{ opId: string; type: string; payload: string; base: string | null }>(
    "SELECT opId, type, payload, base FROM outbox WHERE opId = ?",
    opId
  );
  if (!original) {
    await db.runAsync("DELETE FROM conflicts WHERE opId = ?", opId);
    return;
  }

  if (lado === "celular") {
    const payload = { ...(JSON.parse(original.payload) as Record<string, unknown>), _force: true };
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        "INSERT OR REPLACE INTO outbox (opId, type, payload, base, status, tries, createdAt) VALUES (?, ?, ?, ?, 'pending', 0, ?)",
        `${opId}#force`,
        original.type,
        JSON.stringify(payload),
        original.base,
        new Date().toISOString()
      );
      await db.runAsync("DELETE FROM outbox WHERE opId = ?", opId);
      await db.runAsync("DELETE FROM conflicts WHERE opId = ?", opId);
    });
    return;
  }

  await reverterCriacaoLocal(db, original.type, JSON.parse(original.payload));
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE outbox SET status = 'discarded', lastError = 'escolhi o PC' WHERE opId = ?", opId);
    await db.runAsync("DELETE FROM conflicts WHERE opId = ?", opId);
    await setSyncState(db, "fullPullNext", "1");
  });
}

export async function resolverTodos(db: SQLiteDatabase, escolhas: { opId: string; lado: Lado }[]): Promise<void> {
  for (const e of escolhas) await resolver(db, e.opId, e.lado);
}
