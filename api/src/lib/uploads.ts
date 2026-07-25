import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import multer from "multer";

export const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.resolve(__dirname, "../../../data/uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB por arquivo
});
