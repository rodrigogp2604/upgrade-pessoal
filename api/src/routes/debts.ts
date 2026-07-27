import { Router } from "express";
import { z } from "zod";
import { route } from "../lib/http";
import { createDebt, deleteDebt, listDebts, payDebt, updateDebt } from "../services/debts.service";

export const debtsRouter = Router();

// lista chefões (dívidas) com pago/restante calculados
debtsRouter.get(
  "/",
  route(async (_req, res) => {
    res.json(await listDebts());
  })
);

const createSchema = z.object({
  name: z.string().min(1),
  note: z.string().optional().nullable(),
  kind: z.enum(["debt", "item"]).default("debt"),
  total: z.number().positive(),
});

// adiciona novo chefão: dívida pura ou aquisição de item (compra não quitada)
debtsRouter.post(
  "/",
  route(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.status(201).json(await createDebt(parsed.data));
  })
);

debtsRouter.patch(
  "/:id",
  route(async (req, res) => {
    const parsed = createSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await updateDebt(Number(req.params.id), parsed.data));
  })
);

debtsRouter.delete(
  "/:id",
  route(async (req, res) => {
    await deleteDebt(Number(req.params.id));
    res.status(204).end();
  })
);

const paySchema = z.object({
  amount: z.number().positive(),
  note: z.string().optional().nullable(),
  clientUuid: z.string().optional().nullable(),
});

// "atacar o chefão" = registrar pagamento
debtsRouter.post(
  "/:id/pay",
  route(async (req, res) => {
    const parsed = paySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const result = await payDebt({ debtId: Number(req.params.id), ...parsed.data });
    res.json({ debt: result.debt, defeated: result.defeated });
  })
);
