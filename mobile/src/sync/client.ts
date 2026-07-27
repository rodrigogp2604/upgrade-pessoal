// Cliente HTTP do sync. Nada de biblioteca: fetch + AbortController.
//
// Timeout curto é decisão de produto — o app tem que decidir rápido "o PC não está aqui"
// e voltar a funcionar offline, em vez de deixar a tela pensando.
import type { Pairing } from "./pairing";
import { parteDeArquivo } from "@/sync/filepart";

export const TIMEOUT_PING = 2500;
export const TIMEOUT_DADOS = 20000;

export class SyncError extends Error {
  constructor(
    message: string,
    public readonly code: "offline" | "unauthorized" | "server" | "timeout",
    public readonly status?: number
  ) {
    super(message);
  }
}

function baseUrl(p: Pairing): string {
  return `http://${p.host}:${p.port}`;
}

async function pedir<T>(
  p: Pairing,
  deviceId: string,
  caminho: string,
  opcoes: { method?: "GET" | "POST"; body?: unknown; timeout?: number } = {}
): Promise<T> {
  const controle = new AbortController();
  const corta = setTimeout(() => controle.abort(), opcoes.timeout ?? TIMEOUT_DADOS);

  try {
    const res = await fetch(baseUrl(p) + caminho, {
      method: opcoes.method ?? "GET",
      headers: {
        Authorization: `Bearer ${p.token}`,
        "X-Device-Id": deviceId,
        ...(opcoes.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
      signal: controle.signal,
    });

    if (res.status === 401) {
      throw new SyncError("pareamento expirado — leia o QR de novo", "unauthorized", 401);
    }
    if (!res.ok) {
      throw new SyncError(`o servidor respondeu ${res.status}`, "server", res.status);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof SyncError) throw e;
    // AbortError e falha de rede caem aqui: para o app, é a mesma coisa — sem PC.
    const abortou = (e as Error)?.name === "AbortError";
    throw new SyncError(abortou ? "o PC não respondeu" : "sem conexão com o PC", abortou ? "timeout" : "offline");
  } finally {
    clearTimeout(corta);
  }
}

export type PingResposta = {
  ok: boolean;
  protocol: number;
  serverTime: string;
  /** versão publicada no PC — é assim que o app sabe que envelheceu (não há loja) */
  latestApp: { version: string; versionCode: number; url: string } | null;
};

export const ping = (p: Pairing, dev: string) =>
  pedir<PingResposta>(p, dev, "/api/sync/ping", { timeout: TIMEOUT_PING });

export const hello = (p: Pairing, dev: string, name: string) =>
  pedir<{ deviceId: string; lastPulledAt: string | null }>(p, dev, "/api/sync/hello", {
    method: "POST",
    body: { deviceId: dev, name },
    timeout: TIMEOUT_PING * 2,
  });

export type PullResposta = {
  cursor: string;
  hasMore: boolean;
  changes: {
    character: { name: string; xp: number; stats: Record<string, number>; updatedAt: string } | null;
    titles: { id: number; level: number; name: string; updatedAt: string }[];
    weeks: {
      id: number; floor: number; theme: string; startDate: string; status: string;
      rating: number | null; review: string | null; closedAt: string | null; updatedAt: string;
    }[];
    missions: {
      id: number; weekId: number; order: number; kind?: string; title: string;
      description: string | null; bonus: string | null; xp: number;
      statGains: Record<string, number>; status: string; rating: number | null;
      completedAt: string | null; updatedAt: string;
    }[];
    attachments: {
      id: number; missionId: number; originalName: string; mimeType: string; size: number;
      clientUuid: string | null; url: string; createdAt: string; updatedAt: string;
    }[];
    debts: {
      id: number; name: string; note: string | null; kind: string; total: number;
      status: string; order: number; updatedAt: string;
    }[];
    payments: {
      id: number; debtId: number; amount: number; note: string | null; date: string;
      clientUuid: string | null; updatedAt: string;
    }[];
    settings: { key: string; value: string; updatedAt: string }[];
    visits: string[];
    briefing: { id: number; content: string; createdAt: string } | null;
  };
  deleted: Record<string, string[]>;
};

export const pull = (p: Pairing, dev: string, since: string | null) =>
  pedir<PullResposta>(p, dev, `/api/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ""}`);

export type OpParaEnviar = {
  opId: string;
  type: string;
  base?: unknown;
  payload: Record<string, unknown>;
  force?: boolean;
};

export type ResultadoOp =
  | { opId: string; status: "applied"; replay?: boolean; data?: Record<string, unknown> | null }
  | { opId: string; status: "rejected"; reason: string; message: string }
  | {
      opId: string; status: "conflict"; reason: string; entity: string; entityId: string;
      mine: { label: string }; theirs: { label: string }; serverUpdatedAt?: string;
    };

export const push = (p: Pairing, dev: string, ops: OpParaEnviar[]) =>
  pedir<{ cursor: string; results: ResultadoOp[] }>(p, dev, "/api/sync/push", {
    method: "POST",
    body: { deviceId: dev, ops },
  });

/**
 * Sobe uma prova (multipart). Fica fora do `pedir()` porque aqui o corpo não é JSON e o
 * Content-Type tem que ser montado pelo runtime, com o boundary.
 */
export async function enviarProva(
  p: Pairing,
  dev: string,
  prova: { opId: string; missionId: number; clientUuid: string; uri: string; nome: string; mime: string }
): Promise<{ status: string; data?: unknown }> {
  const form = new FormData();
  form.append("file", parteDeArquivo(prova.uri, prova.nome, prova.mime) as Blob);
  form.append("opId", prova.opId);
  form.append("missionId", String(prova.missionId));
  form.append("clientUuid", prova.clientUuid);

  const controle = new AbortController();
  // prova é arquivo: merece bem mais paciência que uma chamada de JSON
  const corta = setTimeout(() => controle.abort(), 60000);

  try {
    const res = await fetch(`${baseUrl(p)}/api/sync/attachments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.token}`, "X-Device-Id": dev },
      body: form,
      signal: controle.signal,
    });

    if (res.status === 401) throw new SyncError("pareamento expirado", "unauthorized", 401);
    if (res.status === 413) throw new SyncError("prova maior que o limite do servidor", "server", 413);
    if (!res.ok) throw new SyncError(`o servidor respondeu ${res.status}`, "server", res.status);

    return (await res.json()) as { status: string; data?: unknown };
  } catch (e) {
    if (e instanceof SyncError) throw e;
    const abortou = (e as Error)?.name === "AbortError";
    throw new SyncError(abortou ? "o envio da prova demorou demais" : "sem conexão com o PC", abortou ? "timeout" : "offline");
  } finally {
    clearTimeout(corta);
  }
}

/**
 * Procura o servidor na faixa /24 do endereço conhecido. Serve para quando o DHCP troca o
 * IP do PC — em vez de "reparear", o app reencontra sozinho. Testa em lotes para não
 * abrir 254 conexões de uma vez.
 */
export async function procurarNaRede(
  p: Pairing,
  dev: string,
  aoProgredir?: (testados: number, total: number) => void
): Promise<string | null> {
  const partes = p.host.split(".");
  if (partes.length !== 4) return null;
  const prefixo = partes.slice(0, 3).join(".");

  const candidatos = Array.from({ length: 254 }, (_, i) => `${prefixo}.${i + 1}`).filter((ip) => ip !== p.host);
  const LOTE = 16;
  let testados = 0;

  for (let i = 0; i < candidatos.length; i += LOTE) {
    const lote = candidatos.slice(i, i + LOTE);
    const achados = await Promise.all(
      lote.map(async (host) => {
        try {
          const r = await ping({ ...p, host }, dev);
          return r.ok ? host : null;
        } catch {
          return null;
        }
      })
    );
    testados += lote.length;
    aoProgredir?.(Math.min(testados, candidatos.length), candidatos.length);
    const achou = achados.find(Boolean);
    if (achou) return achou;
  }

  return null;
}
