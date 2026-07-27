// Chefões (dívidas e aquisições) e seus ataques (pagamentos).
import { prisma } from "../db";
import { debtView } from "../lib/views";
import { syncFinancialHealth } from "../lib/finance";
import { notFound } from "../lib/errors";
import { recordTombstone } from "../lib/tombstones";

export type DebtInput = {
  name: string;
  note?: string | null;
  kind: "debt" | "item";
  total: number;
};

const withPayments = { payments: true } as const;

export async function listDebts() {
  const debts = await prisma.debt.findMany({ orderBy: { order: "asc" }, include: withPayments });
  const view = debts.map(debtView);
  const total = view.reduce((a, d) => a + d.total, 0);
  const paid = view.reduce((a, d) => a + d.paid, 0);
  return { debts: view, totals: { total, paid, remaining: Math.max(0, total - paid) } };
}

export async function createDebt(input: DebtInput) {
  const count = await prisma.debt.count();
  const debt = await prisma.debt.create({
    data: {
      name: input.name,
      note: input.note ?? null,
      kind: input.kind,
      total: input.total,
      order: count + 1,
    },
    include: withPayments,
  });
  await syncFinancialHealth();
  return debtView(debt);
}

export async function updateDebt(id: number, patch: Partial<DebtInput>) {
  const existing = await prisma.debt.findUnique({ where: { id } });
  if (!existing) throw notFound("dívida não encontrada");

  const debt = await prisma.debt.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
      ...(patch.total !== undefined ? { total: patch.total } : {}),
    },
    include: withPayments,
  });
  await syncFinancialHealth();
  return debtView(debt);
}

export async function deleteDebt(id: number) {
  const existing = await prisma.debt.findUnique({ where: { id } });
  if (!existing) throw notFound("dívida não encontrada");
  await prisma.debt.delete({ where: { id } });
  await recordTombstone("debt", id); // pagamentos somem por cascata
  await syncFinancialHealth();
}

export type PayInput = {
  debtId: number;
  amount: number;
  note?: string | null;
  clientUuid?: string | null;
};

// "Atacar o chefão" = registrar pagamento.
// `clientUuid` vem do celular: se o mesmo ataque chegar duas vezes (envio repetido,
// app morto no meio), o segundo não tira HP de novo.
export async function payDebt(input: PayInput) {
  const debt = await prisma.debt.findUnique({ where: { id: input.debtId }, include: withPayments });
  if (!debt) throw notFound("dívida não encontrada");

  const duplicate = input.clientUuid
    ? await prisma.payment.findUnique({ where: { clientUuid: input.clientUuid } })
    : null;

  if (!duplicate) {
    await prisma.payment.create({
      data: {
        debtId: input.debtId,
        amount: input.amount,
        note: input.note ?? null,
        clientUuid: input.clientUuid ?? null,
      },
    });
  }

  const updated = await prisma.debt.findUniqueOrThrow({ where: { id: input.debtId }, include: withPayments });
  const view = debtView(updated);
  if (view.remaining <= 0 && updated.status !== "dead") {
    await prisma.debt.update({ where: { id: input.debtId }, data: { status: "dead" } });
    view.status = "dead";
  }
  await syncFinancialHealth();
  return { debt: view, defeated: view.remaining <= 0, duplicate: Boolean(duplicate) };
}

// Heurística de duplicata para a tela de conflitos do app: mesmo chefão, mesmo valor,
// dentro de 24 h. Não bloqueia nada sozinha — só levanta a mão para o usuário decidir.
export async function findSimilarPayment(debtId: number, amount: number, withinHours = 24) {
  const since = new Date(Date.now() - withinHours * 3600_000);
  return prisma.payment.findFirst({
    where: { debtId, amount, date: { gte: since } },
    orderBy: { date: "desc" },
  });
}

export async function findDebtByName(name: string) {
  // SQLite no Prisma não aceita `mode: "insensitive"`; comparação manual resolve.
  const all = await prisma.debt.findMany({ where: { status: "active" }, select: { id: true, name: true } });
  const target = name.trim().toLocaleLowerCase();
  return all.find((d) => d.name.trim().toLocaleLowerCase() === target) ?? null;
}

export async function getDebt(id: number) {
  const debt = await prisma.debt.findUnique({ where: { id }, include: withPayments });
  if (!debt) throw notFound("dívida não encontrada");
  return debtView(debt);
}
