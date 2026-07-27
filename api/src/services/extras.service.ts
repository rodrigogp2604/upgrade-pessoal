// Freelas / ganhos por fora. Vivem numa Setting JSON (não é sistema financeiro).
//
// Cada entrada ganhou um `id`: sem ele, celular e painel adicionando freelas diferentes
// no mesmo dia gerariam conflito de lista inteira. Com id, a união é trivial e ninguém
// precisa escolher nada. Entradas antigas (só {name, value}) recebem id na primeira
// escrita — a migração acontece sozinha, sem script.
import crypto from "node:crypto";
import { prisma } from "../db";
import { safeJson } from "../lib/views";

export type Extra = { id: string; name: string; value: number; at?: string };

const KEY = "extras";

function normalize(raw: unknown): Extra[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e.name === "string" && typeof e.value === "number")
    .map((e) => ({
      id: typeof e.id === "string" && e.id ? e.id : crypto.randomUUID(),
      name: e.name,
      value: e.value,
      ...(typeof e.at === "string" ? { at: e.at } : {}),
    }));
}

export async function listExtras(): Promise<Extra[]> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  return normalize(safeJson<unknown>(row?.value ?? "[]", []));
}

async function save(list: Extra[]): Promise<Extra[]> {
  const value = JSON.stringify(list);
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
  return list;
}

// Idempotente pelo id: reenviar o mesmo freela não duplica a linha.
export async function addExtra(extra: Extra): Promise<Extra[]> {
  const list = await listExtras();
  if (list.some((e) => e.id === extra.id)) return list;
  return save([...list, extra]);
}

export async function removeExtra(id: string): Promise<Extra[]> {
  const list = await listExtras();
  return save(list.filter((e) => e.id !== id));
}
