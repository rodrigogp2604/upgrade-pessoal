import { Router } from "express";
import fs from "node:fs";
import { route } from "../lib/http";
import { removeUpload, upload } from "../lib/uploads";
import {
  addAttachment,
  cleanupOrphans,
  deleteAttachment,
  findOrphans,
  getAttachmentFile,
} from "../services/attachments.service";

export const attachmentsRouter = Router();

// anexa provas a uma missão (múltiplos arquivos)
attachmentsRouter.post(
  "/missions/:id/attachments",
  upload.array("files", 10),
  route(async (req, res) => {
    const missionId = Number(req.params.id);
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) return res.status(400).json({ error: "nenhum arquivo enviado" });

    const created = [];
    for (const [i, f] of files.entries()) {
      try {
        const { attachment } = await addAttachment(missionId, f);
        created.push(attachment);
      } catch (e) {
        // O multer já gravou TODOS os arquivos antes deste handler rodar. Se um deles não
        // vira linha, os que ainda não foram processados ficariam no disco sem dono para
        // sempre (o próprio addAttachment cuida do arquivo que ele recusou).
        await Promise.all(files.slice(i + 1).map((resto) => removeUpload(resto.filename)));
        throw e;
      }
    }
    res.status(201).json(created);
  })
);

// ───────────────────────────── manutenção ─────────────────────────────
// Antes das rotas com `:id` porque "orphans" não é um id — e ler isso na ordem do arquivo
// é mais barato que confiar no formato das rotas.

// Relatório: provas quebradas (linha sem arquivo) e arquivos sem dono.
attachmentsRouter.get(
  "/attachments/orphans",
  route(async (_req, res) => {
    res.json(await findOrphans());
  })
);

// Apaga as linhas quebradas. Confira o relatório antes: `backupPath` diz quando os bytes
// ainda existem em backups/ e a prova pode ser restaurada em vez de esquecida.
attachmentsRouter.post(
  "/attachments/orphans/cleanup",
  route(async (_req, res) => {
    res.json(await cleanupOrphans());
  })
);

// baixa/visualiza uma prova
attachmentsRouter.get(
  "/attachments/:id/download",
  route(async (req, res) => {
    const { attachment, filePath } = await getAttachmentFile(Number(req.params.id));
    if (!fs.existsSync(filePath)) {
      return res.status(410).json({
        error: `prova quebrada: "${attachment.originalName}" está registrada mas o arquivo não está em data/uploads`,
        code: "file_missing",
        hint: "GET /api/attachments/orphans mostra todas as provas quebradas e se há backup",
      });
    }
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(attachment.originalName)}"`);
    fs.createReadStream(filePath).pipe(res);
  })
);

// remove uma prova
attachmentsRouter.delete(
  "/attachments/:id",
  route(async (req, res) => {
    await deleteAttachment(Number(req.params.id));
    res.status(204).end();
  })
);
