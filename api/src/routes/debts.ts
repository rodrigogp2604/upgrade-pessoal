import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { debtView } from "../lib/views";
import { syncFinancialHealth } from "../lib/finance";

export const debtsRouter = Router();

// lista chefões (dívidas) com pago/restante calculados
debtsRouter.get("/", async (_req, res) => {
  const debts = await prisma.debt.findMany({ orderBy: { order: "asc" }, include: { payments: true } });
  const view = debts.map(debtView);
  const total = view.reduce((a, d) => a + d.total, 0);
  const paid = view.reduce((a, d) => a + d.paid, 0);
  res.json({ debts: view, totals: { total, paid, remaining: Math.max(0, total - paid) } });
});

const createSchema = z.object({
  name: z.string().min(1),
  note: z.string().optional().nullable(),
  kind: z.enum(["debt", "item"]).default("debt"),
  total: z.number().positive(),
});

// adiciona novo chefão: dívida pura ou aquisição de item (compra não quitada)
debtsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const count = await prisma.debt.count();
  const debt = await prisma.debt.create({
    data: {
      name: parsed.data.name,
      note: parsed.data.note ?? null,
      kind: parsed.data.kind,
      total: parsed.data.total,
      order: count + 1,
    },
    include: { payments: true },
  });
  await syncFinancialHealth();
  res.status(201).json(debtView(debt));
});

debtsRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;
  const debt = await prisma.debt.update({
    where: { id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.note !== undefined ? { note: d.note } : {}),
      ...(d.kind !== undefined ? { kind: d.kind } : {}),
      ...(d.total !== undefined ? { total: d.total } : {}),
    },
    include: { payments: true },
  });
  await syncFinancialHealth();
  res.json(debtView(debt));
});

debtsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.debt.delete({ where: { id } });
  await syncFinancialHealth();
  res.status(204).end();
});

const paySchema = z.object({ amount: z.number().positive(), note: z.string().optional().nullable() });

// "atacar o chefão" = registrar pagamento
debtsRouter.post("/:id/pay", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = paySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const debt = await prisma.debt.findUnique({ where: { id }, include: { payments: true } });
  if (!debt) return res.status(404).json({ error: "dívida não encontrada" });

  await prisma.payment.create({ data: { debtId: id, amount: parsed.data.amount, note: parsed.data.note ?? null } });

  const updated = await prisma.debt.findUniqueOrThrow({ where: { id }, include: { payments: true } });
  const view = debtView(updated);
  if (view.remaining <= 0 && updated.status !== "dead") {
    await prisma.debt.update({ where: { id }, data: { status: "dead" } });
    view.status = "dead";
  }
  await syncFinancialHealth();
  res.json({ debt: view, defeated: view.remaining <= 0 });
});
