import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../db";
import { upload, UPLOAD_DIR } from "../lib/uploads";

export const attachmentsRouter = Router();

// anexa provas a uma missão (múltiplos arquivos)
attachmentsRouter.post("/missions/:id/attachments", upload.array("files", 10), async (req, res) => {
  const missionId = Number(req.params.id);
  const mission = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!mission) return res.status(404).json({ error: "missão não encontrada" });

  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) return res.status(400).json({ error: "nenhum arquivo enviado" });

  const created = [];
  for (const f of files) {
    const att = await prisma.attachment.create({
      data: {
        missionId,
        filename: f.filename,
        originalName: f.originalname,
        mimeType: f.mimetype,
        size: f.size,
      },
    });
    created.push({
      id: att.id,
      originalName: att.originalName,
      mimeType: att.mimeType,
      size: att.size,
      createdAt: att.createdAt,
      url: `/api/attachments/${att.id}/download`,
    });
  }
  res.status(201).json(created);
});

// baixa/visualiza uma prova
attachmentsRouter.get("/attachments/:id/download", async (req, res) => {
  const id = Number(req.params.id);
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) return res.status(404).json({ error: "anexo não encontrado" });
  const filePath = path.join(UPLOAD_DIR, att.filename);
  if (!fs.existsSync(filePath)) return res.status(410).json({ error: "arquivo ausente no disco" });
  res.setHeader("Content-Type", att.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(att.originalName)}"`);
  fs.createReadStream(filePath).pipe(res);
});

// remove uma prova
attachmentsRouter.delete("/attachments/:id", async (req, res) => {
  const id = Number(req.params.id);
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) return res.status(404).json({ error: "anexo não encontrado" });
  const filePath = path.join(UPLOAD_DIR, att.filename);
  fs.promises.unlink(filePath).catch(() => {});
  await prisma.attachment.delete({ where: { id } });
  res.status(204).end();
});
