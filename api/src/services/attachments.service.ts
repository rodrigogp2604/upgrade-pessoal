// Provas anexadas às missões. O arquivo em si vive em data/uploads/; aqui fica só o registro.
//
// A regra que governa este arquivo: **linha e arquivo nascem e morrem juntos.** Linha sem
// arquivo é prova quebrada (conta no painel, 410 no download, vira "sem prova" na revisão
// de domingo); arquivo sem linha é só lixo invisível. Quando algo tem que sobrar, que
// sobre o lixo.
import { prisma } from "../db";
import { attachmentView } from "../lib/views";
import {
  findInBackups,
  listUploads,
  removeUpload,
  uploadExists,
  uploadPath,
  uploadWritten,
} from "../lib/uploads";
import { notFound, uploadFailed } from "../lib/errors";
import { recordTombstone } from "../lib/tombstones";

export type UploadedFile = {
  filename: string; // nome no disco, gerado pelo multer
  originalname: string;
  mimetype: string;
  size: number;
};

// `clientUuid` vem do celular. Se a mesma prova chegar de novo (retry de upload),
// o arquivo recém-gravado é descartado e o registro original é devolvido — nada duplica.
//
// Todo upload passa por aqui — o do painel e o do celular (`POST /api/sync/attachments`).
// É de propósito: a garantia de "só cria linha com arquivo no disco" vale para os dois sem
// precisar ser escrita duas vezes.
export async function addAttachment(missionId: number, file: UploadedFile, clientUuid?: string | null) {
  const mission = await prisma.mission.findUnique({ where: { id: missionId }, select: { id: true } });
  if (!mission) {
    await removeUpload(file.filename);
    throw notFound("missão não encontrada");
  }

  if (clientUuid) {
    const existing = await prisma.attachment.findUnique({ where: { clientUuid } });
    if (existing) {
      await removeUpload(file.filename);
      return { attachment: attachmentView(existing), duplicate: true };
    }
  }

  // o arquivo tem que estar mesmo no disco, e inteiro, ANTES de existir linha no banco
  if (!(await uploadWritten(file.filename, file.size))) {
    await removeUpload(file.filename);
    throw uploadFailed("a prova não chegou inteira ao disco — anexe de novo");
  }

  try {
    const att = await prisma.attachment.create({
      data: {
        missionId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        clientUuid: clientUuid ?? null,
      },
    });
    return { attachment: attachmentView(att), duplicate: false };
  } catch (e) {
    // sem linha, o arquivo nunca será encontrado por ninguém: tirar do disco fecha o ciclo
    await removeUpload(file.filename);
    throw e;
  }
}

export async function getAttachmentFile(id: number) {
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) throw notFound("anexo não encontrado");
  return { attachment: att, filePath: uploadPath(att.filename) };
}

export async function deleteAttachment(id: number) {
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) throw notFound("anexo não encontrado");
  // Banco primeiro. Se a exclusão da linha falhar depois de o arquivo já ter ido, sobra
  // exatamente a prova quebrada que este arquivo existe para evitar; na ordem inversa, o
  // pior caso é um arquivo órfão — que o relatório de manutenção enxerga.
  await prisma.attachment.delete({ where: { id } });
  await recordTombstone("attachment", id);
  await removeUpload(att.filename);
}

// ───────────────────────────── manutenção ─────────────────────────────

export type OrphanReport = {
  /** linhas de Attachment cujo arquivo não está em data/uploads/ — provas quebradas */
  rows: {
    id: number;
    missionId: number;
    missionTitle: string;
    originalName: string;
    filename: string;
    createdAt: Date;
    /** caminho num backup, quando os bytes ainda existem em backups/ */
    backupPath: string | null;
  }[];
  /** arquivos em data/uploads/ que nenhuma linha reivindica — lixo, não prova perdida */
  files: string[];
};

export async function findOrphans(): Promise<OrphanReport> {
  const [atts, files] = await Promise.all([
    prisma.attachment.findMany({
      orderBy: { id: "asc" },
      include: { mission: { select: { title: true } } },
    }),
    listUploads(),
  ]);

  const reivindicados = new Set(atts.map((a) => a.filename));

  return {
    rows: atts
      .filter((a) => !uploadExists(a.filename))
      .map((a) => ({
        id: a.id,
        missionId: a.missionId,
        missionTitle: a.mission.title,
        originalName: a.originalName,
        filename: a.filename,
        createdAt: a.createdAt,
        backupPath: findInBackups(a.filename),
      })),
    files: files.filter((f) => !reivindicados.has(f)),
  };
}

/**
 * Apaga as linhas sem arquivo (com lápide, para o celular esquecer a prova na próxima
 * sincronização em vez de ficar mostrando um anexo que não abre).
 *
 * Arquivos órfãos NÃO são apagados: um arquivo sem linha pode ser prova recuperável de um
 * banco restaurado pela metade, e apagá-lo é irreversível. O relatório mostra quais são.
 */
export async function cleanupOrphans(): Promise<{ removed: OrphanReport["rows"]; files: string[] }> {
  const { rows, files } = await findOrphans();
  for (const row of rows) {
    await prisma.attachment.delete({ where: { id: row.id } });
    await recordTombstone("attachment", row.id);
  }
  return { removed: rows, files };
}
