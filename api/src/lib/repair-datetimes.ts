import { prisma } from "../db";

// ── Conserto de um detalhe traiçoeiro do SQLite ────────────────────────────────
// O Prisma grava DateTime como INTEGER (ms desde a época). Quando `prisma db push`
// adiciona uma coluna de data numa tabela que já tem linhas, ele preenche as antigas
// com TEXT ("2026-07-26T19:16:53.000Z").
//
// SQLite é de tipagem dinâmica e ordena por classe de tipo: INTEGER sempre vem antes
// de TEXT. Resultado: `WHERE updatedAt >= <cursor>` casa com TODA linha em TEXT, para
// sempre. O pull incremental do celular voltaria o banco inteiro toda vez e o cursor
// viraria enfeite.
//
// Roda no start, é idempotente e só toca linha em TEXT. Custa milissegundos.
const TABLES = ["Title", "Briefing", "Visit", "Week", "Mission", "Attachment", "Debt", "Payment", "Setting"];
const COLUMN = "updatedAt";

export async function repairLegacyDateTimes(): Promise<number> {
  let fixed = 0;

  for (const table of TABLES) {
    // julianday() entende o ISO-8601 com Z; se não entender, devolve NULL e a linha
    // fica de fora (melhor pular do que gravar lixo numa coluna NOT NULL).
    const affected = await prisma.$executeRawUnsafe(
      `UPDATE "${table}"
          SET "${COLUMN}" = CAST((julianday("${COLUMN}") - 2440587.5) * 86400000.0 AS INTEGER)
        WHERE typeof("${COLUMN}") = 'text'
          AND julianday("${COLUMN}") IS NOT NULL`
    );
    fixed += affected;
  }

  if (fixed > 0) console.log(`🩹 ${fixed} datas normalizadas para o cursor de sincronização.`);
  return fixed;
}
