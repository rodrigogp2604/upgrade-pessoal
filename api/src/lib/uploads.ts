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

export function uploadPath(filename: string): string {
  return path.join(UPLOAD_DIR, filename);
}

// Linha de Attachment sem arquivo é uma prova QUEBRADA: conta no painel, responde 410 no
// download e, pior, o ritual de domingo julga a missão como "sem prova" (teto de 3★).
// Por isso "o arquivo existe?" é pergunta de primeira classe aqui.
export function uploadExists(filename: string): boolean {
  return fs.existsSync(uploadPath(filename));
}

/**
 * O multer só devolve o arquivo depois de fechar o stream — mas "fechou" não é o mesmo que
 * "está inteiro no disco": corpo cortado no meio, disco cheio ou erro de fs deixam o
 * arquivo faltando ou menor do que o `size` anunciado. É este teste que autoriza a criação
 * da linha no banco.
 */
export async function uploadWritten(filename: string, expectedSize: number): Promise<boolean> {
  try {
    const st = await fs.promises.stat(uploadPath(filename));
    return st.isFile() && st.size === expectedSize;
  } catch {
    return false;
  }
}

// Nunca lança: quem chama está sempre no meio de um caminho de erro ou de exclusão, e
// falhar em apagar lixo não é motivo para derrubar a requisição.
export async function removeUpload(filename: string): Promise<void> {
  await fs.promises.unlink(uploadPath(filename)).catch(() => {});
}

export async function listUploads(): Promise<string[]> {
  return fs.promises.readdir(UPLOAD_DIR).catch(() => []);
}

// Provas que sumiram de data/uploads/ costumam estar num backup — `scripts/backup.ps1`
// copia a pasta data/ inteira para backups/data_<carimbo>/. Saber que o arquivo é
// recuperável é a diferença entre "apagar o registro" e "restaurar a prova".
export function findInBackups(filename: string): string | null {
  const backupsDir = path.resolve(UPLOAD_DIR, "../../backups");
  let entradas: string[];
  try {
    entradas = fs.readdirSync(backupsDir);
  } catch {
    return null;
  }
  for (const entrada of entradas) {
    const candidato = path.join(backupsDir, entrada, "uploads", filename);
    if (fs.existsSync(candidato)) return candidato;
  }
  return null;
}
