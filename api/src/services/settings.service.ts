import { prisma } from "../db";
import { syncFinancialHealth } from "../lib/finance";
import { AppError } from "../lib/errors";

// Settings que NUNCA saem por /api/settings nem podem ser escritas por ele.
// `sync_token` é o segredo do pareamento: vazá-lo entrega o banco para qualquer
// aparelho na mesma rede Wi-Fi.
export const HIDDEN_SETTING_KEYS = new Set(["sync_token"]);

// Keys que o celular pode escrever pelo sync (o resto é do painel/cowork).
// `income_current` é o salário de hoje; as outras metas de renda (start/checkpoint/target)
// saem do briefing e o app não mexe.
// `extras` NÃO entra aqui de propósito: freela vai por `extra.add`/`extra.remove`, que
// funde por id em vez de sobrescrever a lista inteira.
export const MOBILE_WRITABLE_KEYS = new Set(["income_current", "pouch", "pouch_goal", "avatar"]);

export async function getPublicSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  const obj: Record<string, string> = {};
  for (const r of rows) {
    if (HIDDEN_SETTING_KEYS.has(r.key)) continue;
    obj[r.key] = r.value;
  }
  return obj;
}

export async function putSetting(key: string, value: string) {
  if (HIDDEN_SETTING_KEYS.has(key)) {
    throw new AppError("forbidden_setting", `a configuração "${key}" não pode ser alterada por aqui`, 403);
  }
  const row = await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  // bolsa de ouro / meta de reserva alimentam o atributo Saúde Financeira
  if (key === "pouch" || key === "pouch_goal") await syncFinancialHealth();
  return { [row.key]: row.value };
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}
