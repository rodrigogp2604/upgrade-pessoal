// Provas anexadas às missões. O arquivo em si vive em data/uploads/; aqui fica só o registro.
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../db";
import { attachmentView } from "../lib/views";
import { UPLOAD_DIR } from "../lib/uploads";
import { notFound } from "../lib/errors";
import { recordTombstone } from "../lib/tombstones";

export type UploadedFile = {
  filename: string; // nome no disco, gerado pelo multer
  originalname: string;
  mimetype: string;
  size: number;
};

function filePathOf(filename: string) {
  return path.join(UPLOAD_DIR, filename);
}

async function removeFile(filename: string) {
  await fs.promises.unlink(filePathOf(filename)).catch(() => {});
}

// `clientUuid` vem do celular. Se a mesma prova chegar de novo (retry de upload),
// o arquivo recém-gravado é descartado e o registro original é devolvido — nada duplica.
export async function addAttachment(missionId: number, file: UploadedFile, clientUuid?: string | null) {
  const mission = await prisma.mission.findUnique({ where: { id: missionId }, select: { id: true } });
  if (!mission) {
    await removeFile(file.filename);
    throw notFound("missão não encontrada");
  }

  if (clientUuid) {
    const existing = await prisma.attachment.findUnique({ where: { clientUuid } });
    if (existing) {
      await removeFile(file.filename);
      return { attachment: attachmentView(existing), duplicate: true };
    }
  }

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
}

export async function getAttachmentFile(id: number) {
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) throw notFound("anexo não encontrado");
  return { attachment: att, filePath: filePathOf(att.filename) };
}

export async function deleteAttachment(id: number) {
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) throw notFound("anexo não encontrado");
  await removeFile(att.filename);
  await prisma.attachment.delete({ where: { id } });
  await recordTombstone("attachment", id);
}
