// Adaptador fino: expõe o SQLite embutido do Node com a MESMA interface do expo-sqlite.
// Assim os testes exercitam o SQL de verdade de src/db/*, e não uma cópia dele.
import { DatabaseSync } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";

export function abrirBancoDeTeste(): SQLiteDatabase {
  const db = new DatabaseSync(":memory:");

  const adaptador = {
    async execAsync(sql: string) {
      db.exec(sql);
    },
    async runAsync(sql: string, ...params: unknown[]) {
      const r = db.prepare(sql).run(...(params as never[]));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]) {
      return (db.prepare(sql).get(...(params as never[])) ?? null) as T | null;
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]) {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
    // O expo-sqlite serializa transações; aqui basta BEGIN/COMMIT com rollback no erro.
    async withTransactionAsync(fn: () => Promise<void>) {
      db.exec("BEGIN");
      try {
        await fn();
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    async closeAsync() {
      db.close();
    },
  };

  return adaptador as unknown as SQLiteDatabase;
}
