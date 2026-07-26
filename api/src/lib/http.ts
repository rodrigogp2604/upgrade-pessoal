import type { ErrorRequestHandler, Request, RequestHandler, Response } from "express";
import { isAppError } from "./errors";

// Express 4 não captura promise rejeitada dentro do handler: sem isso, um throw de
// service deixaria a requisição pendurada até o timeout do navegador.
export function route(handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (isAppError(err)) {
    const extra = typeof err.details === "object" && err.details !== null ? err.details : {};
    return res.status(err.status).json({ error: err.message, code: err.code, ...extra });
  }
  console.error("❌ erro não tratado:", err);
  res.status(500).json({ error: "erro interno", code: "internal" });
};
