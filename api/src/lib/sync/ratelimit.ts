import type { RequestHandler } from "express";

// Janela deslizante simples em memória. Não é proteção contra ataque sério — é cinto
// de segurança para app em loop de retry não martelar o servidor de casa.
// O limite é alto de propósito: a primeira sincronização de um celular com muitas
// provas faz um upload por arquivo.
const WINDOW_MS = 60_000;
const MAX_HITS = 120;

const hits = new Map<string, number[]>();

export function rateLimit(max = MAX_HITS): RequestHandler {
  return (req, res, next) => {
    const key = req.header("x-device-id") ?? req.ip ?? "desconhecido";
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    recent.push(now);
    hits.set(key, recent);

    if (recent.length > max) {
      res.setHeader("Retry-After", "60");
      return res.status(429).json({ error: "muitas requisições, respira", code: "rate_limited" });
    }
    next();
  };
}
