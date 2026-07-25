// Entrypoint de produção (Docker): aplica o schema, popula se vazio e sobe o servidor.
import { execSync } from "node:child_process";
import path from "node:path";
import { createApp } from "./server";
import { seedIfEmpty } from "./seed";

async function main() {
  const apiRoot = path.resolve(__dirname, "..");

  console.log("📦 Aplicando schema no banco (prisma db push)...");
  execSync("npx prisma db push --skip-generate", { stdio: "inherit", cwd: apiRoot });

  const seeded = await seedIfEmpty();
  console.log(seeded ? "🌱 Seed inicial aplicado." : "✅ Banco já populado.");

  const PORT = Number(process.env.PORT) || 4000;
  createApp().listen(PORT, () => {
    console.log(`🎮 Upgrade Pessoal rodando em http://localhost:${PORT}`);
  });
}

main().catch((e) => {
  console.error("❌ Falha ao iniciar:", e);
  process.exit(1);
});
