// Semeadura de desenvolvimento. O app de verdade nasce VAZIO e só se enche pelo pull do
// PC — mas para desenhar tela sem servidor no meio, isto injeta o mock no banco local.
// Só existe em __DEV__: no APK a função nem é chamada.
import type { SQLiteDatabase } from "expo-sqlite";
import { MOCK } from "@/game/mock";

const agora = () => new Date().toISOString();

export async function seedDev(db: SQLiteDatabase): Promise<void> {
  const ts = agora();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT INTO character (id, name, xp, stats, updatedAt) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, xp = excluded.xp, stats = excluded.stats",
      MOCK.character.name,
      MOCK.character.xp,
      JSON.stringify(MOCK.character.stats),
      ts
    );

    for (const t of MOCK.titles) {
      await db.runAsync("INSERT OR REPLACE INTO titles (id, level, name, updatedAt) VALUES (?, ?, ?, ?)", t.id, t.level, t.name, ts);
    }

    for (const w of MOCK.weeks) {
      await db.runAsync(
        "INSERT OR REPLACE INTO weeks (id, floor, theme, startDate, status, rating, review, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        w.id, w.floor, w.theme, w.startDate, w.status, w.rating, w.review, ts
      );
    }

    for (const m of MOCK.missions) {
      await db.runAsync(
        `INSERT OR REPLACE INTO missions (id, weekId, "order", title, description, bonus, xp, statGains, status, rating, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        m.id, m.weekId, m.order, m.title, m.description, m.bonus, m.xp,
        JSON.stringify(m.statGains), m.status, m.rating, ts
      );
      // `kind` mora numa coluna própria no servidor; aqui o mock marca as duas últimas
      await db.runAsync("UPDATE missions SET kind = ? WHERE id = ?", m.kind === "side" ? "side" : "main", m.id);
    }

    for (const a of MOCK.attachments) {
      await db.runAsync(
        "INSERT OR REPLACE INTO attachments (id, missionId, originalName, url, updatedAt) VALUES (?, ?, ?, ?, ?)",
        a.id, a.missionId, a.originalName, a.url, ts
      );
    }

    for (const d of MOCK.debts) {
      await db.runAsync(
        'INSERT OR REPLACE INTO debts (id, name, note, kind, total, status, "order", updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        d.id, d.name, d.note, d.kind, d.total, d.status, d.id, ts
      );
      if (d.paid > 0) {
        await db.runAsync(
          "INSERT OR REPLACE INTO payments (id, debtId, amount, note, date) VALUES (?, ?, ?, ?, ?)",
          d.id * 1000, d.id, d.paid, "histórico", ts
        );
      }
    }

    const configs = { ...MOCK.settings, extras: JSON.stringify(MOCK.extras) };
    for (const [key, value] of Object.entries(configs)) {
      await db.runAsync(
        "INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        key, String(value), ts
      );
    }

    // streak de exemplo: hoje e os dias anteriores em sequência
    for (let i = 0; i < MOCK.streak; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      await db.runAsync("INSERT OR IGNORE INTO visits (date) VALUES (?)", d.toISOString().slice(0, 10));
    }
  });
}

export async function wipeLocal(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const t of ["attachments", "missions", "weeks", "payments", "debts", "titles", "settings", "visits", "character", "outbox", "conflicts", "pending_files", "sync_state"]) {
      await db.runAsync(`DELETE FROM ${t}`);
    }
  });
}
