import { prisma } from "../db";
import { safeJson } from "./views";

// "Saúde Financeira" é um atributo de jogo, não contabilidade. Fórmula transparente:
//   metade = bolsa de ouro vs meta de reserva (settings pouch / pouch_goal)
//   metade = quanto dos chefões (dívidas/aquisições) já foi pago
// Sem meta de reserva definida ou sem chefões, a metade correspondente conta como 100.
export async function syncFinancialHealth(): Promise<void> {
  const char = await prisma.character.findUnique({ where: { id: 1 } });
  if (!char) return;

  const debts = await prisma.debt.findMany({ include: { payments: true } });
  const totalDebt = debts.reduce((a, d) => a + d.total, 0);
  const totalPaid = debts.reduce((a, d) => a + d.payments.reduce((s, p) => s + p.amount, 0), 0);
  const debtPct = totalDebt > 0 ? Math.min(100, (totalPaid / totalDebt) * 100) : 100;

  const settings = await prisma.setting.findMany({ where: { key: { in: ["pouch", "pouch_goal"] } } });
  const get = (k: string) => Number(settings.find((s) => s.key === k)?.value ?? 0);
  const pouch = get("pouch");
  const goal = get("pouch_goal");
  const pouchPct = goal > 0 ? Math.min(100, (pouch / goal) * 100) : 100;

  const value = Math.round(0.5 * pouchPct + 0.5 * debtPct);

  const stats = safeJson<Record<string, number>>(char.stats, {});
  stats["Saúde Financeira"] = value;
  await prisma.character.update({ where: { id: 1 }, data: { stats: JSON.stringify(stats) } });
}
