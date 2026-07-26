// Pareamento: o QR do painel carrega endereço do PC + token.
//
// O token vai para o cofre do sistema (SecureStore, criptografado pelo Android) e nunca
// para o SQLite — banco de app pode ser lido em aparelho com root ou em backup.
// Endereço e id do aparelho não são segredo e ficam no banco, junto do cursor.
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import type { SQLiteDatabase } from "expo-sqlite";
import { getSyncState, setSyncState } from "@/db/repo";

const CHAVE_TOKEN = "upgrade_sync_token";

export type Pairing = { host: string; port: number; token: string };

export type QrPayload = { v?: number; host?: string; port?: number; token?: string };

/** O painel gera `{"v":1,"host":"192.168.0.14","port":4000,"token":"…"}`. */
export function parseQr(bruto: string): Pairing | null {
  let dados: QrPayload;
  try {
    dados = JSON.parse(bruto) as QrPayload;
  } catch {
    return null;
  }
  const host = (dados.host ?? "").trim();
  const port = Number(dados.port ?? 4000);
  const token = (dados.token ?? "").trim();
  if (!host || !token || !Number.isFinite(port)) return null;
  return { host, port, token };
}

export async function salvarPareamento(db: SQLiteDatabase, p: Pairing): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_TOKEN, p.token);
  await setSyncState(db, "host", p.host);
  await setSyncState(db, "port", String(p.port));
}

export async function lerPareamento(db: SQLiteDatabase): Promise<Pairing | null> {
  const [token, host, port] = await Promise.all([
    SecureStore.getItemAsync(CHAVE_TOKEN),
    getSyncState(db, "host"),
    getSyncState(db, "port"),
  ]);
  if (!token || !host) return null;
  return { token, host, port: Number(port ?? 4000) };
}

export async function esquecerPareamento(db: SQLiteDatabase): Promise<void> {
  await SecureStore.deleteItemAsync(CHAVE_TOKEN);
  await setSyncState(db, "host", "");
}

/** Só troca o endereço (DHCP mudou o IP do PC), mantendo o token. */
export async function trocarHost(db: SQLiteDatabase, host: string, port = 4000): Promise<void> {
  await setSyncState(db, "host", host.trim());
  await setSyncState(db, "port", String(port));
}

/** Id do aparelho: gerado uma vez e guardado. É como o painel lista "Moto G do Rodrigo". */
export async function deviceId(db: SQLiteDatabase): Promise<string> {
  const salvo = await getSyncState(db, "deviceId");
  if (salvo) return salvo;
  const novo = Crypto.randomUUID();
  await setSyncState(db, "deviceId", novo);
  return novo;
}

export function deviceName(): string {
  return [Device.manufacturer, Device.modelName].filter(Boolean).join(" ") || "Celular";
}
