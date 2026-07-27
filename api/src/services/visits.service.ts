import { prisma } from "../db";
import { isoDay } from "../lib/streak";

// Check-in do dia (idempotente). Aceita data explícita porque o celular pode ter
// visitado offline numa terça e só sincronizar na quinta — o streak é do jogador,
// não do momento em que o Wi-Fi apareceu.
export async function markVisit(date: string = isoDay()): Promise<void> {
  await prisma.visit.upsert({ where: { date }, update: {}, create: { date } });
}
