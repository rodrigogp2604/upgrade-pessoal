// Motor de sincronização com o app mobile.
//
// Direções assimétricas de propósito:
//   PC → celular  = snapshot incremental (o cowork edita tudo, o app só reflete)
//   celular → PC  = fila de operações (o app produz eventos: concluí, paguei, anexei)
//
// Toda operação aplicada deixa registro em SyncOp. É isso que garante que um envio
// repetido — app morto no meio, Wi-Fi caindo, retry automático — não credite XP duas vezes.
import { prisma } from "../db";
import { safeJson } from "../lib/views";
import { AppError } from "../lib/errors";
import { HIDDEN_SETTING_KEYS, MOBILE_WRITABLE_KEYS, putSetting } from "./settings.service";
import { completeMission, uncompleteMission } from "./missions.service";
import { createDebt, findDebtByName, findSimilarPayment, payDebt } from "./debts.service";
import { addExtra, removeExtra } from "./extras.service";
import { markVisit } from "./visits.service";
import { deleteAttachment } from "./attachments.service";

// ─────────────────────────────── PULL ───────────────────────────────

// Reentregar linha é inofensivo (o app aplica por upsert no id do servidor), perder
// linha não é. Daí a sobreposição: o cursor volta 2s no tempo.
const OVERLAP_MS = 2000;

export type PullResult = Awaited<ReturnType<typeof pull>>;

export async function pull(since?: string | null) {
  const cursor = new Date();

  let sinceDate = new Date(0);
  if (since) {
    const parsed = new Date(since);
    if (Number.isNaN(parsed.getTime())) {
      throw new AppError("invalid_payload", "parâmetro `since` inválido", 400);
    }
    sinceDate = new Date(parsed.getTime() - OVERLAP_MS);
  }
  const changed = { updatedAt: { gte: sinceDate } };

  const [character, titles, weeks, missions, attachments, debts, payments, settings, visits, briefing, tombstones] =
    await Promise.all([
      prisma.character.findFirst({ where: { id: 1, ...changed } }),
      prisma.title.findMany({ where: changed, orderBy: { level: "asc" } }),
      prisma.week.findMany({ where: changed, orderBy: { id: "asc" } }),
      prisma.mission.findMany({ where: changed, orderBy: { id: "asc" } }),
      prisma.attachment.findMany({ where: changed, orderBy: { id: "asc" } }),
      prisma.debt.findMany({ where: changed, orderBy: { order: "asc" } }),
      prisma.payment.findMany({ where: changed, orderBy: { id: "asc" } }),
      prisma.setting.findMany({ where: changed }),
      prisma.visit.findMany({ where: changed, select: { date: true } }),
      prisma.briefing.findFirst({ where: changed, orderBy: { id: "desc" } }),
      prisma.tombstone.findMany({ where: { at: { gte: sinceDate } } }),
    ]);

  const deleted: Record<string, string[]> = {};
  for (const t of tombstones) (deleted[t.entity] ??= []).push(t.entityId);

  return {
    cursor: cursor.toISOString(),
    // O acervo de um jogador cabe folgado numa resposta só; se um dia não couber,
    // é aqui que entra paginação.
    hasMore: false,
    changes: {
      character: character
        ? {
            id: character.id,
            name: character.name,
            xp: character.xp,
            stats: safeJson<Record<string, number>>(character.stats, {}),
            updatedAt: character.updatedAt,
          }
        : null,
      titles,
      weeks,
      missions: missions.map((m) => ({
        ...m,
        statGains: safeJson<Record<string, number>>(m.statGains, {}),
      })),
      attachments: attachments.map((a) => ({ ...a, url: `/api/attachments/${a.id}/download` })),
      debts,
      payments,
      settings: settings.filter((s) => !HIDDEN_SETTING_KEYS.has(s.key)),
      visits: visits.map((v) => v.date),
      briefing: briefing ? { id: briefing.id, content: briefing.content, createdAt: briefing.createdAt } : null,
    },
    deleted,
  };
}

// ─────────────────────────────── PUSH ───────────────────────────────

export const OP_TYPES = [
  "mission.complete",
  "mission.uncomplete",
  "payment.create",
  "debt.create",
  "extra.add",
  "extra.remove",
  "setting.put",
  "visit.mark",
  "attachment.delete",
] as const;

export type OpType = (typeof OP_TYPES)[number];

export type PushOp = {
  opId: string;
  type: string;
  base?: { updatedAt?: string | null; status?: string | null; value?: string | null } | null;
  payload?: Record<string, unknown> | null;
  force?: boolean;
};

export type OpResult =
  | { opId: string; status: "applied"; replay?: boolean; data?: unknown }
  | { opId: string; status: "rejected"; reason: string; message: string }
  | {
      opId: string;
      status: "conflict";
      reason: string;
      entity: string;
      entityId: string;
      mine: { label: string };
      theirs: { label: string };
      serverUpdatedAt?: string;
    };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const when = (d: Date) =>
  d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const reject = (opId: string, reason: string, message: string): OpResult => ({
  opId,
  status: "rejected",
  reason,
  message,
});

export async function push(deviceId: string, ops: PushOp[]) {
  const results: OpResult[] = [];
  // Em ordem: "paguei 200 e depois 300" tem que chegar assim do outro lado.
  for (const op of ops) results.push(await applyOp(deviceId, op));
  return { cursor: new Date().toISOString(), results };
}

async function applyOp(deviceId: string, op: PushOp): Promise<OpResult> {
  if (!op.opId) return reject("desconhecida", "invalid_payload", "operação sem opId");
  if (!OP_TYPES.includes(op.type as OpType)) {
    return reject(op.opId, "forbidden_op", `o app não pode executar "${op.type}"`);
  }

  // Já aplicada antes? Devolve o mesmo resultado sem tocar no banco.
  // Conflito NÃO é memorizado: o estado do PC pode ter mudado desde então.
  const seen = await prisma.syncOp.findUnique({ where: { opId: op.opId } });
  if (seen) {
    const data = seen.resultJson ? safeJson<unknown>(seen.resultJson, null) : null;
    return seen.status === "applied"
      ? { opId: op.opId, status: "applied", replay: true, data }
      : reject(op.opId, "replay", "operação já havia sido recusada antes");
  }

  const result = await runOp(op);

  if (result.status !== "conflict") {
    await prisma.syncOp.create({
      data: {
        opId: op.opId,
        deviceId,
        type: op.type,
        status: result.status,
        resultJson: JSON.stringify(result.status === "applied" ? (result.data ?? null) : result),
      },
    });
  }
  return result;
}

async function runOp(op: PushOp): Promise<OpResult> {
  const payload = (op.payload ?? {}) as Record<string, any>;

  switch (op.type as OpType) {
    case "mission.complete":
      return missionStatusOp(op, Number(payload.missionId), "done");

    case "mission.uncomplete":
      return missionStatusOp(op, Number(payload.missionId), "pending");

    case "payment.create": {
      const debtId = Number(payload.debtId);
      const amount = Number(payload.amount);
      const clientUuid = String(payload.clientUuid ?? "");
      if (!debtId || !(amount > 0) || !clientUuid) {
        return reject(op.opId, "invalid_payload", "pagamento precisa de debtId, amount e clientUuid");
      }

      const debt = await prisma.debt.findUnique({ where: { id: debtId } });
      if (!debt) return reject(op.opId, "not_found", "chefão não encontrado (apagado no PC?)");

      // Já lançado no PC um pagamento igual, hoje? Pode ser o mesmo dinheiro contado
      // duas vezes — quem sabe é o jogador.
      if (!op.force) {
        const similar = await findSimilarPayment(debtId, amount);
        if (similar && similar.clientUuid !== clientUuid) {
          return {
            opId: op.opId,
            status: "conflict",
            reason: "possible_duplicate",
            entity: "payment",
            entityId: String(similar.id),
            mine: { label: `${brl(amount)} · ${debt.name} (celular)` },
            theirs: { label: `${brl(similar.amount)} · ${when(similar.date)} (PC)` },
            serverUpdatedAt: similar.updatedAt.toISOString(),
          };
        }
      }

      const paid = await payDebt({ debtId, amount, note: payload.note ?? null, clientUuid });
      return { opId: op.opId, status: "applied", data: { debtId, defeated: paid.defeated } };
    }

    case "debt.create": {
      const name = String(payload.name ?? "").trim();
      const total = Number(payload.total);
      if (!name || !(total > 0)) return reject(op.opId, "invalid_payload", "chefão precisa de nome e valor");

      if (!op.force) {
        const existing = await findDebtByName(name);
        if (existing) {
          return {
            opId: op.opId,
            status: "conflict",
            reason: "possible_duplicate",
            entity: "debt",
            entityId: String(existing.id),
            mine: { label: `${name} · ${brl(total)} (celular)` },
            theirs: { label: `${existing.name} · já existe no PC` },
          };
        }
      }

      const debt = await createDebt({
        name,
        total,
        note: payload.note ?? null,
        kind: payload.kind === "item" ? "item" : "debt",
      });
      return { opId: op.opId, status: "applied", data: { debtId: debt.id } };
    }

    case "extra.add": {
      const id = String(payload.id ?? "");
      const name = String(payload.name ?? "").trim();
      const value = Number(payload.value);
      if (!id || !name || Number.isNaN(value)) {
        return reject(op.opId, "invalid_payload", "freela precisa de id, nome e valor");
      }
      await addExtra({ id, name, value, at: typeof payload.at === "string" ? payload.at : undefined });
      return { opId: op.opId, status: "applied", data: { id } };
    }

    case "extra.remove": {
      const id = String(payload.id ?? "");
      if (!id) return reject(op.opId, "invalid_payload", "informe o id do freela");
      await removeExtra(id);
      return { opId: op.opId, status: "applied", data: { id } };
    }

    case "setting.put": {
      const key = String(payload.key ?? "");
      const value = String(payload.value ?? "");
      if (!MOBILE_WRITABLE_KEYS.has(key)) {
        return reject(op.opId, "forbidden_op", `o app não pode alterar "${key}"`);
      }

      const current = await prisma.setting.findUnique({ where: { key } });
      if (!op.force && current && current.value !== value) {
        const baseAt = op.base?.updatedAt ? new Date(op.base.updatedAt) : null;
        // O PC mexeu nisso depois da foto que o celular tinha → escolha do jogador.
        if (baseAt && current.updatedAt > baseAt) {
          return {
            opId: op.opId,
            status: "conflict",
            reason: "value_changed",
            entity: "setting",
            entityId: key,
            mine: { label: `${labelForSetting(key)}: ${value} (celular)` },
            theirs: { label: `${labelForSetting(key)}: ${current.value} (PC, ${when(current.updatedAt)})` },
            serverUpdatedAt: current.updatedAt.toISOString(),
          };
        }
      }

      await putSetting(key, value);
      return { opId: op.opId, status: "applied", data: { key } };
    }

    case "visit.mark": {
      const date = String(payload.date ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return reject(op.opId, "invalid_payload", "data inválida");
      await markVisit(date);
      return { opId: op.opId, status: "applied", data: { date } };
    }

    case "attachment.delete": {
      const id = Number(payload.attachmentId);
      if (!id) return reject(op.opId, "invalid_payload", "informe o attachmentId");
      const exists = await prisma.attachment.findUnique({ where: { id } });
      if (!exists) return { opId: op.opId, status: "applied", data: { id, alreadyGone: true } };
      await deleteAttachment(id);
      return { opId: op.opId, status: "applied", data: { id } };
    }

    default:
      return reject(op.opId, "forbidden_op", `operação "${op.type}" não reconhecida`);
  }
}

function labelForSetting(key: string): string {
  const map: Record<string, string> = {
    income_current: "Salário",
    pouch: "Bolsa de ouro",
    pouch_goal: "Meta da bolsa",
    avatar: "Foto do personagem",
  };
  return map[key] ?? key;
}

async function missionStatusOp(op: PushOp, missionId: number, desired: "done" | "pending"): Promise<OpResult> {
  if (!missionId) return reject(op.opId, "invalid_payload", "informe o missionId");

  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    include: { week: { select: { status: true, theme: true } } },
  });
  if (!mission) return reject(op.opId, "not_found", "missão não existe mais no PC");

  if (mission.week.status === "closed") {
    return reject(op.opId, "week_closed", `o arco "${mission.week.theme}" já foi fechado com o cowork`);
  }

  // Já está no estado desejado: nada a fazer, e principalmente nada de XP de novo.
  if (mission.status === desired) {
    return { opId: op.opId, status: "applied", data: { missionId, noop: true } };
  }

  // O PC mexeu nessa missão depois da foto que o celular tinha, e discorda do destino.
  // Caso clássico: o app concluiu offline enquanto o PC desfazia de propósito.
  if (!op.force && op.base?.updatedAt) {
    const baseAt = new Date(op.base.updatedAt);
    if (!Number.isNaN(baseAt.getTime()) && mission.updatedAt > baseAt) {
      const label = (s: string) => (s === "done" ? "concluída" : "pendente");
      return {
        opId: op.opId,
        status: "conflict",
        reason: "status_changed",
        entity: "mission",
        entityId: String(mission.id),
        mine: { label: `${mission.title} — ${label(desired)} (celular)` },
        theirs: { label: `${mission.title} — ${label(mission.status)} no PC, ${when(mission.updatedAt)}` },
        serverUpdatedAt: mission.updatedAt.toISOString(),
      };
    }
  }

  if (desired === "done") {
    const r = await completeMission(missionId);
    return {
      opId: op.opId,
      status: "applied",
      data: { missionId, gainedXp: r.gainedXp, leveledUp: r.leveledUp, newLevel: r.newLevel },
    };
  }

  await uncompleteMission(missionId);
  return { opId: op.opId, status: "applied", data: { missionId } };
}
