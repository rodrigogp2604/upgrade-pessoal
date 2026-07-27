import crypto from "node:crypto";
import type { RequestHandler } from "express";
import { prisma } from "../../db";

// O segredo do pareamento mora numa Setting escondida (settings.service esconde a key
// do GET /api/settings). Quem tem o token fala com o banco inteiro — por isso ele nunca
// trafega em query string nem aparece em log.
const TOKEN_KEY = "sync_token";

export async function getSyncToken(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: TOKEN_KEY } });
  return row?.value ?? null;
}

// Gera um token novo. Todo aparelho pareado com o anterior perde o acesso —
// é o "trocar a fechadura" do painel.
export async function rotateSyncToken(): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.setting.upsert({
    where: { key: TOKEN_KEY },
    update: { value: token },
    create: { key: TOKEN_KEY, value: token },
  });
  await prisma.device.deleteMany();
  return token;
}

function bearerFrom(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && value ? value : null;
}

// Compara pelo digest para que o tempo de resposta não entregue nem o valor nem o
// tamanho do token.
function sameSecret(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export const requireSyncToken: RequestHandler = (req, res, next) => {
  const provided = bearerFrom(req.header("authorization"));
  if (!provided) return res.status(401).json({ error: "token ausente", code: "unauthorized" });

  getSyncToken()
    .then((stored) => {
      if (!stored) {
        return res.status(401).json({ error: "nenhum celular pareado ainda", code: "not_paired" });
      }
      if (!sameSecret(provided, stored)) {
        return res.status(401).json({ error: "pareamento expirado — leia o QR de novo", code: "bad_token" });
      }
      next();
    })
    .catch(next);
};

export function deviceIdFrom(req: { header(name: string): string | undefined }): string | null {
  return req.header("x-device-id") ?? null;
}
