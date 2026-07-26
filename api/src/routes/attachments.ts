import { Router } from "express";
import fs from "node:fs";
import { route } from "../lib/http";
import { upload } from "../lib/uploads";
import { addAttachment, deleteAttachment, getAttachmentFile } from "../services/attachments.service";

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
    for (const f of files) {
      const { attachment } = await addAttachment(missionId, f);
      created.push(attachment);
    }
    res.status(201).json(created);
  })
);

// baixa/visualiza uma prova
attachmentsRouter.get(
  "/attachments/:id/download",
  route(async (req, res) => {
    const { attachment, filePath } = await getAttachmentFile(Number(req.params.id));
    if (!fs.existsSync(filePath)) return res.status(410).json({ error: "arquivo ausente no disco" });
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
