// Erro de regra de negócio lançado pelos services.
// Existe para que a MESMA função sirva a duas bocas: a rota HTTP (vira status + json)
// e o push do sync (vira um resultado de operação com motivo legível no celular).
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly status = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type AppErrorCode =
  | "not_found"
  | "invalid_payload"
  | "week_closed"
  | "week_active"
  | "forbidden_setting"
  | "already_closed"
  | "unauthorized";

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

export const notFound = (message: string) => new AppError("not_found", message, 404);
