// Seed manual: `npm run db:seed`. Só popula se o banco estiver vazio.
import { seedIfEmpty } from "../src/seed";
import { prisma } from "../src/db";

seedIfEmpty()
  .then((did) => {
    console.log(did ? "✅ Seed inicial aplicado." : "ℹ️  Banco já tinha dados — nada a fazer.");
  })
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
