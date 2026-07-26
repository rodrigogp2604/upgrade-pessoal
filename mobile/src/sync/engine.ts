// Uma rodada de sincronização: ping → push (em passes) → pull.
//
// Ordem pensada: primeiro sobe o que eu fiz, depois baixo a verdade do PC. Se fosse o
// contrário, o pull sobrescreveria a missão que acabei de concluir e o app "desfaria"
// na frente do usuário.
import type { SQLiteDatabase } from "expo-sqlite";
import { aplicarPull, idServidorDe, remapearId } from "./apply";
import { hello, ping, pull, push, SyncError, type OpParaEnviar, type ResultadoOp } from "./client";
import { deviceId, deviceName, lerPareamento } from "./pairing";
import { discard, markApplied, markConflict, markError, pendingOps, type OutboxRow } from "@/db/outbox";
import { reverterCriacaoLocal } from "@/db/mutations";
import { getSyncState, setSyncState } from "@/db/repo";

export type Estado = "nao_pareado" | "offline" | "sincronizando" | "ok" | "conflitos" | "erro";

export type Resultado = {
  estado: Estado;
  mensagem?: string;
  enviadas: number;
  conflitos: number;
  recusadas: number;
  baixou: boolean;
};

const PASSES = 3; // o bastante para "criei o chefão e paguei ele" resolver na mesma rodada
const LOTE = 25;

export async function sincronizar(db: SQLiteDatabase): Promise<Resultado> {
  const base: Resultado = { estado: "ok", enviadas: 0, conflitos: 0, recusadas: 0, baixou: false };

  const pareamento = await lerPareamento(db);
  if (!pareamento) return { ...base, estado: "nao_pareado" };

  const dev = await deviceId(db);

  try {
    await ping(pareamento, dev);
  } catch (e) {
    const erro = e as SyncError;
    return { ...base, estado: erro.code === "unauthorized" ? "erro" : "offline", mensagem: erro.message };
  }

  // registra/atualiza o aparelho no painel — falhar aqui não impede sincronizar
  await hello(pareamento, dev, deviceName()).catch(() => {});

  let enviadas = 0;
  let conflitos = 0;
  let recusadas = 0;
  // Recusa exige pull COMPLETO: o app assumiu um estado que o PC não aceitou, e o pull
  // incremental não traria a linha de volta (lá nada mudou, o updatedAt continua velho).
  // Sem isso, uma missão recusada ficaria "concluída" no celular para sempre.
  let precisaPullCompleto = false;

  try {
    for (let passe = 0; passe < PASSES; passe++) {
      const fila = await pendingOps(db, LOTE);
      if (fila.length === 0) break;

      const prontas: { row: OutboxRow; op: OpParaEnviar; localId?: number }[] = [];
      for (const row of fila) {
        const preparada = await prepararOp(db, row);
        if (preparada) prontas.push(preparada);
      }
      // nada enviável (só operações esperando o id de algo que ainda não subiu)
      if (prontas.length === 0) break;

      const resposta = await push(pareamento, dev, prontas.map((p) => p.op));

      for (const resultado of resposta.results) {
        const item = prontas.find((p) => p.op.opId === resultado.opId);
        if (!item) continue;

        if (resultado.status === "applied") {
          await tratarAplicada(db, item.row, item.localId, resultado);
          enviadas++;
        } else if (resultado.status === "conflict") {
          await markConflict(db, item.row.opId, {
            entity: resultado.entity,
            entityId: resultado.entityId,
            reason: resultado.reason,
            mineLabel: resultado.mine.label,
            theirsLabel: resultado.theirs.label,
          });
          conflitos++;
        } else {
          // recusa por regra (arco fechado, missão apagada no PC…)
          await reverterCriacaoLocal(db, item.row.type, JSON.parse(item.row.payload));
          await discard(db, item.row.opId, resultado.reason);
          recusadas++;
          precisaPullCompleto = true;
        }
      }

      if (prontas.length < fila.length) continue; // ainda há ops esperando id
      if (fila.length < LOTE) break;
    }
  } catch (e) {
    const erro = e as SyncError;
    const fila = await pendingOps(db, 1);
    if (fila[0]) await markError(db, fila[0].opId, erro.message);
    return { ...base, estado: erro.code === "unauthorized" ? "erro" : "offline", mensagem: erro.message, enviadas, conflitos, recusadas };
  }

  try {
    // "escolhi o PC" na tela de conflitos também pede a verdade inteira de volta
    const pedidoNaTela = (await getSyncState(db, "fullPullNext")) === "1";
    const cursor = precisaPullCompleto || pedidoNaTela ? null : await getSyncState(db, "cursor");

    const resposta = await pull(pareamento, dev, cursor);
    await aplicarPull(db, resposta);
    if (pedidoNaTela) await setSyncState(db, "fullPullNext", "0");
    return { estado: conflitos > 0 ? "conflitos" : "ok", enviadas, conflitos, recusadas, baixou: true };
  } catch (e) {
    const erro = e as SyncError;
    return { ...base, estado: "offline", mensagem: erro.message, enviadas, conflitos, recusadas };
  }
}

/**
 * Prepara a operação para ir na rede:
 *  - tira os campos internos (`_localId`), que são assunto do app;
 *  - troca id provisório por id real do servidor (via id_map).
 * Devolve null quando a dependência ainda não subiu — a operação espera o próximo passe.
 */
async function prepararOp(
  db: SQLiteDatabase,
  row: OutboxRow
): Promise<{ row: OutboxRow; op: OpParaEnviar; localId?: number } | null> {
  const payload = JSON.parse(row.payload) as Record<string, unknown>;
  const localId = typeof payload._localId === "number" ? (payload._localId as number) : undefined;
  const force = payload._force === true;

  // campos com "_" são combinados internos do app; nunca vão para a rede
  for (const chave of Object.keys(payload)) {
    if (chave.startsWith("_")) delete payload[chave];
  }

  if (row.type === "payment.create" && typeof payload.debtId === "number" && (payload.debtId as number) < 0) {
    const real = await idServidorDe(db, "debts", payload.debtId as number);
    if (!real) return null; // o chefão dono deste pagamento ainda não existe no PC
    payload.debtId = real;
  }

  return {
    row,
    localId,
    op: {
      opId: row.opId,
      type: row.type,
      base: row.base ? JSON.parse(row.base) : undefined,
      payload,
      ...(force ? { force: true } : {}),
    },
  };
}

async function tratarAplicada(
  db: SQLiteDatabase,
  row: OutboxRow,
  localId: number | undefined,
  resultado: Extract<ResultadoOp, { status: "applied" }>
): Promise<void> {
  const dados = resultado.data ?? {};

  if (row.type === "debt.create" && localId && typeof dados.debtId === "number") {
    await remapearId(db, "debts", localId, dados.debtId);
  }

  await markApplied(db, row.opId);
}
