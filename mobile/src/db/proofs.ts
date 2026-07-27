// Provas no banco local. A linha aparece na hora (id negativo) e o arquivo entra na fila
// de upload — anexar uma prova offline não pode depender de rede nenhuma.
import type { SQLiteDatabase } from "expo-sqlite";
import { enqueue, novoId } from "./outbox";

export type ProvaLocal = {
  id: number;
  missionId: number;
  originalName: string;
  mimeType: string | null;
  size: number | null;
  url: string | null;
  localUri: string | null;
  clientUuid: string | null;
};

export type PendingFile = {
  opId: string;
  missionId: number;
  localUri: string;
  clientUuid: string;
  bytes: number | null;
};

export async function listarProvas(db: SQLiteDatabase, missionId: number): Promise<ProvaLocal[]> {
  return db.getAllAsync<ProvaLocal>(
    "SELECT id, missionId, originalName, mimeType, size, url, localUri, clientUuid FROM attachments WHERE missionId = ? ORDER BY id DESC",
    missionId
  );
}

/** Grava a prova localmente e agenda o upload. Devolve o id local (negativo). */
export async function anexarProvaLocal(
  db: SQLiteDatabase,
  missionId: number,
  prova: { clientUuid: string; uri: string; thumbUri: string | null; originalName: string; mimeType: string; size: number }
): Promise<number> {
  const row = await db.getFirstAsync<{ menor: number | null }>("SELECT MIN(id) AS menor FROM attachments");
  const idLocal = Math.min(row?.menor ?? 0, 0) - 1;
  const agora = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO attachments (id, missionId, originalName, mimeType, size, localUri, clientUuid, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      idLocal, missionId, prova.originalName, prova.mimeType, prova.size,
      prova.thumbUri ?? prova.uri, prova.clientUuid, agora, agora
    );

    // o opId do upload é a chave de idempotência no servidor (tabela SyncOp lá)
    const opId = novoId();
    await db.runAsync(
      "INSERT INTO pending_files (opId, missionId, localUri, clientUuid, bytes, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
      opId, missionId, prova.uri, prova.clientUuid, prova.size, agora
    );
  });

  return idLocal;
}

export async function provasPendentes(db: SQLiteDatabase, limite = 5): Promise<PendingFile[]> {
  return db.getAllAsync<PendingFile>(
    "SELECT opId, missionId, localUri, clientUuid, bytes FROM pending_files ORDER BY createdAt ASC LIMIT ?",
    limite
  );
}

export async function marcarProvaEnviada(db: SQLiteDatabase, opId: string): Promise<void> {
  await db.runAsync("DELETE FROM pending_files WHERE opId = ?", opId);
}

export async function contarProvasPendentes(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM pending_files");
  return row?.n ?? 0;
}

/**
 * Remove a prova. Se ela nunca subiu, morre só aqui; se já está no PC, entra na fila para
 * ser apagada lá também.
 */
export async function removerProvaLocal(db: SQLiteDatabase, id: number): Promise<{ arquivoParaApagar: string | null }> {
  const prova = await db.getFirstAsync<ProvaLocal>(
    "SELECT id, missionId, originalName, mimeType, size, url, localUri, clientUuid FROM attachments WHERE id = ?",
    id
  );
  if (!prova) return { arquivoParaApagar: null };

  const pendente = prova.clientUuid
    ? await db.getFirstAsync<{ opId: string; localUri: string }>(
        "SELECT opId, localUri FROM pending_files WHERE clientUuid = ?",
        prova.clientUuid
      )
    : null;

  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM attachments WHERE id = ?", id);
    if (pendente) await db.runAsync("DELETE FROM pending_files WHERE opId = ?", pendente.opId);
    // id positivo = existe no servidor, então precisa ser apagada lá
    if (id > 0) await enqueue(db, "attachment.delete", { attachmentId: id });
  });

  return { arquivoParaApagar: pendente?.localUri ?? prova.localUri ?? null };
}
