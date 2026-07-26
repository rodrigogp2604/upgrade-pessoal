import { Router } from "express";
import { z } from "zod";
import { route } from "../lib/http";
import { prisma } from "../db";
import { upload } from "../lib/uploads";
import { deviceIdFrom, getSyncToken, requireSyncToken, rotateSyncToken } from "../lib/sync/token";
import { lanIps } from "../lib/sync/net";
import { rateLimit } from "../lib/sync/ratelimit";
import { push, pull, type PushOp } from "../services/sync.service";
import { addAttachment } from "../services/attachments.service";

export const syncRouter = Router();

const APP_PROTOCOL_VERSION = 1;

// ───────────── pareamento (chamado pelo painel local, sem token) ─────────────
// Estas duas rotas ficam abertas porque só quem já está na máquina/rede abre o painel,
// e é justamente delas que sai o segredo. Quem tem acesso ao painel já tem tudo.

syncRouter.get(
  "/info",
  route(async (_req, res) => {
    const [token, devices] = await Promise.all([
      getSyncToken(),
      prisma.device.findMany({ orderBy: { lastSeen: "desc" } }),
    ]);
    res.json({
      lanIps: lanIps(),
      port: Number(process.env.PORT) || 4000,
      tokenSet: Boolean(token),
      hostLanIpFromEnv: process.env.HOST_LAN_IP ?? null,
      devices: devices.map((d) => ({ id: d.id, name: d.name, lastSeen: d.lastSeen, lastPulledAt: d.lastPulledAt })),
    });
  })
);

// Gera token novo e desparea todo mundo. O painel mostra o QR com o resultado.
syncRouter.post(
  "/pair/new",
  route(async (_req, res) => {
    const token = await rotateSyncToken();
    res.json({
      token,
      hosts: lanIps(),
      port: Number(process.env.PORT) || 4000,
      protocol: APP_PROTOCOL_VERSION,
    });
  })
);

// ───────────── daqui para baixo, só com token ─────────────

syncRouter.use(rateLimit(), requireSyncToken);

syncRouter.get(
  "/ping",
  route(async (_req, res) => {
    res.json({ ok: true, protocol: APP_PROTOCOL_VERSION, serverTime: new Date().toISOString() });
  })
);

const helloSchema = z.object({ deviceId: z.string().min(8), name: z.string().min(1).max(60) });

syncRouter.post(
  "/hello",
  route(async (req, res) => {
    const parsed = helloSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { deviceId, name } = parsed.data;

    const device = await prisma.device.upsert({
      where: { id: deviceId },
      update: { name },
      create: { id: deviceId, name },
    });
    res.json({ deviceId: device.id, lastPulledAt: device.lastPulledAt, protocol: APP_PROTOCOL_VERSION });
  })
);

syncRouter.get(
  "/pull",
  route(async (req, res) => {
    const since = typeof req.query.since === "string" ? req.query.since : null;
    const result = await pull(since);

    const deviceId = deviceIdFrom(req);
    if (deviceId) {
      await prisma.device
        .update({ where: { id: deviceId }, data: { lastPulledAt: new Date(result.cursor) } })
        .catch(() => {}); // aparelho ainda não deu hello: não é motivo para falhar o pull
    }
    res.json(result);
  })
);

const pushSchema = z.object({
  deviceId: z.string().min(8),
  ops: z
    .array(
      z.object({
        opId: z.string().min(8),
        type: z.string().min(1),
        base: z
          .object({
            updatedAt: z.string().nullish(),
            status: z.string().nullish(),
            value: z.string().nullish(),
          })
          .nullish(),
        payload: z.record(z.string(), z.unknown()).nullish(),
        force: z.boolean().optional(),
      })
    )
    .max(200),
});

syncRouter.post(
  "/push",
  route(async (req, res) => {
    const parsed = pushSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await push(parsed.data.deviceId, parsed.data.ops as PushOp[]));
  })
);

// Provas: o binário não cabe no JSON do push, então sobe aqui — com o mesmo contrato
// de idempotência (clientUuid) e registrando a operação em SyncOp.
syncRouter.post(
  "/attachments",
  upload.single("file"),
  route(async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "nenhum arquivo enviado", code: "invalid_payload" });

    const opId = String(req.body.opId ?? "");
    const missionId = Number(req.body.missionId);
    const clientUuid = String(req.body.clientUuid ?? "");
    const deviceId = deviceIdFrom(req) ?? "desconhecido";

    if (!opId || !missionId || !clientUuid) {
      return res.status(400).json({ error: "opId, missionId e clientUuid são obrigatórios", code: "invalid_payload" });
    }

    const seen = await prisma.syncOp.findUnique({ where: { opId } });
    if (seen) {
      return res.json({ opId, status: seen.status, replay: true, data: JSON.parse(seen.resultJson ?? "null") });
    }

    const { attachment, duplicate } = await addAttachment(missionId, file, clientUuid);
    await prisma.syncOp.create({
      data: {
        opId,
        deviceId,
        type: "attachment.create",
        status: "applied",
        resultJson: JSON.stringify({ attachmentId: attachment.id, duplicate }),
      },
    });
    res.status(201).json({ opId, status: "applied", data: { attachment, duplicate } });
  })
);
