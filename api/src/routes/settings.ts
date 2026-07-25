import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { syncFinancialHealth } from "../lib/finance";

export const settingsRouter = Router();

// todas as configs como objeto { key: value }
settingsRouter.get("/", async (_req, res) => {
  const rows = await prisma.setting.findMany();
  const obj: Record<string, string> = {};
  for (const r of rows) obj[r.key] = r.value;
  res.json(obj);
});

const putSchema = z.object({ value: z.string() });

settingsRouter.put("/:key", async (req, res) => {
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const key = req.params.key;
  const row = await prisma.setting.upsert({
    where: { key },
    update: { value: parsed.data.value },
    create: { key, value: parsed.data.value },
  });
  // bolsa de ouro / meta de reserva alimentam o atributo Saúde Financeira
  if (key === "pouch" || key === "pouch_goal") await syncFinancialHealth();
  res.json({ [row.key]: row.value });
});
