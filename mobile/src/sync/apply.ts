// Aplica o snapshot do PC no banco local. Tudo por upsert no id do servidor: reentregar
// a mesma linha é inofensivo, o que é justamente o que permite a janela de sobreposição
// de 2s do cursor.
import type { SQLiteDatabase } from "expo-sqlite";
import type { PullResposta } from "./client";
import { setSyncState } from "@/db/repo";

export async function aplicarPull(db: SQLiteDatabase, resposta: PullResposta): Promise<void> {
  const c = resposta.changes;

  // Registros com conflito aberto ficam de fora: a promessa é que nada seja sobrescrito
  // sem o usuário ver. Se o pull aplicasse a versão do PC aqui, a missão que você concluiu
  // no ônibus voltaria a "pendente" na tela enquanto o card ainda pergunta qual lado vale.
  // Ao resolver, a linha sai desta lista e o próximo pull aplica normalmente.
  const emConflito = await db.getAllAsync<{ entity: string; entityId: string }>(
    "SELECT entity, entityId FROM conflicts"
  );
  const travado = (entidade: string, id: number | string) =>
    emConflito.some((k) => k.entity === entidade && k.entityId === String(id));

  // Conflito de missão mexe com XP: aplicar o personagem do servidor enquanto a missão
  // segue "concluída" na tela deixaria a conta visivelmente errada (feita, mas sem XP).
  const congelarPersonagem = emConflito.some((k) => k.entity === "mission");

  await db.withTransactionAsync(async () => {
    if (c.character && !congelarPersonagem) {
      await db.runAsync(
        `INSERT INTO character (id, name, xp, stats, updatedAt) VALUES (1, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, xp = excluded.xp,
           stats = excluded.stats, updatedAt = excluded.updatedAt`,
        c.character.name,
        c.character.xp,
        JSON.stringify(c.character.stats),
        c.character.updatedAt
      );
    }

    for (const t of c.titles) {
      await db.runAsync(
        `INSERT INTO titles (id, level, name, updatedAt) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET level = excluded.level, name = excluded.name, updatedAt = excluded.updatedAt`,
        t.id, t.level, t.name, t.updatedAt
      );
    }

    for (const w of c.weeks) {
      await db.runAsync(
        `INSERT INTO weeks (id, floor, theme, startDate, status, rating, review, closedAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET floor = excluded.floor, theme = excluded.theme,
           startDate = excluded.startDate, status = excluded.status, rating = excluded.rating,
           review = excluded.review, closedAt = excluded.closedAt, updatedAt = excluded.updatedAt`,
        w.id, w.floor, w.theme, w.startDate, w.status, w.rating, w.review, w.closedAt, w.updatedAt
      );
    }

    for (const m of c.missions) {
      if (travado("mission", m.id)) continue;
      await db.runAsync(
        `INSERT INTO missions (id, weekId, "order", kind, title, description, bonus, xp, statGains, status, rating, completedAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET weekId = excluded.weekId, "order" = excluded."order",
           kind = excluded.kind, title = excluded.title, description = excluded.description,
           bonus = excluded.bonus, xp = excluded.xp, statGains = excluded.statGains,
           status = excluded.status, rating = excluded.rating, completedAt = excluded.completedAt,
           updatedAt = excluded.updatedAt`,
        m.id, m.weekId, m.order, m.kind === "side" ? "side" : "main", m.title, m.description,
        m.bonus, m.xp, JSON.stringify(m.statGains), m.status, m.rating, m.completedAt, m.updatedAt
      );
    }

    for (const a of c.attachments) {
      // prova que subiu deste aparelho: a linha local (id negativo) dá lugar à do servidor
      if (a.clientUuid) {
        await db.runAsync("DELETE FROM attachments WHERE clientUuid = ? AND id < 0", a.clientUuid);
      }
      await db.runAsync(
        `INSERT INTO attachments (id, missionId, originalName, mimeType, size, url, clientUuid, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET missionId = excluded.missionId, originalName = excluded.originalName,
           mimeType = excluded.mimeType, size = excluded.size, url = excluded.url,
           clientUuid = excluded.clientUuid, updatedAt = excluded.updatedAt`,
        a.id, a.missionId, a.originalName, a.mimeType, a.size, a.url, a.clientUuid, a.createdAt, a.updatedAt
      );
    }

    for (const d of c.debts) {
      await db.runAsync(
        `INSERT INTO debts (id, name, note, kind, total, status, "order", updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, note = excluded.note, kind = excluded.kind,
           total = excluded.total, status = excluded.status, "order" = excluded."order",
           updatedAt = excluded.updatedAt`,
        d.id, d.name, d.note, d.kind, d.total, d.status, d.order, d.updatedAt
      );
    }

    for (const pg of c.payments) {
      if (pg.clientUuid) {
        await db.runAsync("DELETE FROM payments WHERE clientUuid = ? AND id < 0", pg.clientUuid);
      }
      await db.runAsync(
        `INSERT INTO payments (id, debtId, amount, note, date, clientUuid, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET debtId = excluded.debtId, amount = excluded.amount,
           note = excluded.note, date = excluded.date, clientUuid = excluded.clientUuid,
           updatedAt = excluded.updatedAt`,
        pg.id, pg.debtId, pg.amount, pg.note, pg.date, pg.clientUuid, pg.updatedAt
      );
    }

    for (const s of c.settings) {
      if (travado("setting", s.key)) continue;
      await db.runAsync(
        `INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
        s.key, s.value, s.updatedAt
      );
    }

    for (const dia of c.visits) {
      await db.runAsync("INSERT OR IGNORE INTO visits (date) VALUES (?)", dia);
    }

    if (c.briefing) {
      await db.runAsync(
        `INSERT INTO briefing (id, content, createdAt) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET content = excluded.content`,
        c.briefing.id, c.briefing.content, c.briefing.createdAt
      );
    }

    // apagado no PC (tabela Tombstone). Filhos vão por cascata das FKs locais.
    const tabelaDe: Record<string, string> = {
      week: "weeks", mission: "missions", attachment: "attachments",
      debt: "debts", payment: "payments", title: "titles",
    };
    for (const [entidade, ids] of Object.entries(resposta.deleted ?? {})) {
      const tabela = tabelaDe[entidade];
      if (!tabela) continue;
      for (const id of ids) await db.runAsync(`DELETE FROM ${tabela} WHERE id = ?`, Number(id));
    }

    await setSyncState(db, "cursor", resposta.cursor);
    await setSyncState(db, "lastSyncAt", new Date().toISOString());
  });
}

/**
 * Troca um id provisório (negativo) pelo id real do servidor.
 *
 * `defer_foreign_keys` é o detalhe que faz isso funcionar: enquanto a troca acontece, o
 * pagamento aponta para um chefão que ainda não existe com aquele id. Adiando a checagem
 * para o commit, o par (pai, filho) fica consistente no fim e o SQLite aceita.
 */
export async function remapearId(
  db: SQLiteDatabase,
  entidade: "debts" | "payments",
  localId: number,
  serverId: number
): Promise<void> {
  if (localId === serverId) return;

  await db.withTransactionAsync(async () => {
    await db.execAsync("PRAGMA defer_foreign_keys = ON");

    if (entidade === "debts") {
      await db.runAsync("UPDATE payments SET debtId = ? WHERE debtId = ?", serverId, localId);
      await db.runAsync("UPDATE debts SET id = ? WHERE id = ?", serverId, localId);
    } else {
      await db.runAsync("UPDATE payments SET id = ? WHERE id = ?", serverId, localId);
    }

    await db.runAsync(
      `INSERT INTO id_map (entity, localId, serverId, createdAt) VALUES (?, ?, ?, ?)
       ON CONFLICT(entity, localId) DO UPDATE SET serverId = excluded.serverId`,
      entidade, localId, serverId, new Date().toISOString()
    );
  });
}

export async function idServidorDe(
  db: SQLiteDatabase,
  entidade: "debts" | "payments",
  localId: number
): Promise<number | null> {
  const row = await db.getFirstAsync<{ serverId: number }>(
    "SELECT serverId FROM id_map WHERE entity = ? AND localId = ?",
    entidade,
    localId
  );
  return row?.serverId ?? null;
}
