// Testes do banco local do app, rodando o SQL de verdade de src/db/*.
//   npm run test:db
import { abrirBancoDeTeste } from "./sqlite-adapter";
import { migrate } from "@/db/schema";
import { loadGameData, countPending, streakDe } from "@/db/repo";
import { pendingOps, markConflict, discard } from "@/db/outbox";
import {
  addExtraLocal, completeMissionLocal, createDebtLocal, markVisitLocal,
  payDebtLocal, putSettingLocal, removeExtraLocal, uncompleteMissionLocal,
} from "@/db/mutations";
import { seedDev } from "@/db/devSeed";

let pass = 0;
let fail = 0;
const ok = (nome: string, cond: boolean, extra = "") => {
  if (cond) { pass++; console.log(`  PASS  ${nome}`); }
  else { fail++; console.log(`  FAIL  ${nome}${extra ? ` — ${extra}` : ""}`); }
};
const secao = (t: string) => console.log(`\n== ${t} ==`);

const db = abrirBancoDeTeste();
await migrate(db);

secao("schema");
const tabelas = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'");
const nomes = tabelas.map((t) => t.name);
ok("cria as tabelas do espelho", ["character", "missions", "weeks", "debts", "payments", "settings", "visits"].every((t) => nomes.includes(t)), nomes.join(","));
ok("cria a máquina de sync", ["outbox", "conflicts", "pending_files", "sync_state"].every((t) => nomes.includes(t)));
const versao = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
ok("grava a versão do schema", versao?.user_version === 1, String(versao?.user_version));
await migrate(db); // idempotente
ok("migrate rodado duas vezes não quebra", true);

secao("banco vazio = aparelho não pareado");
ok("loadGameData devolve null sem personagem", (await loadGameData(db)) === null);

await seedDev(db);
const jogo = await loadGameData(db);
ok("depois do seed existe personagem", jogo?.character.name === "MARINA", jogo?.character.name);
ok("missões carregadas com statGains como objeto", typeof jogo?.missions[0].statGains === "object");
ok("secundárias vêm marcadas", (jogo?.missions.filter((m) => m.kind === "side").length ?? 0) === 2);
ok("dívida traz o pago somado dos pagamentos", jogo?.debts.find((d) => d.id === 1)?.paid === 1150, String(jogo?.debts.find((d) => d.id === 1)?.paid));
ok("freelas saem da setting extras", jogo?.extras.length === 1);

secao("cascata das FKs (o que dispensa lápide de anexo)");
const fk = await db.getFirstAsync<{ foreign_keys: number }>("PRAGMA foreign_keys");
ok("foreign_keys está ligado", fk?.foreign_keys === 1, String(fk?.foreign_keys));
const antes = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM attachments WHERE missionId = 8");
await db.runAsync("DELETE FROM missions WHERE id = 8");
const depois = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM attachments WHERE missionId = 8");
ok("apagar missão apaga as provas dela", (antes?.n ?? 0) > 0 && depois?.n === 0, `antes=${antes?.n} depois=${depois?.n}`);
await seedDev(db); // repõe

secao("concluir missão: XP local + operação na fila");
const alvo = (await loadGameData(db))!.missions.find((m) => m.status === "pending")!;
const xpAntes = (await loadGameData(db))!.character.xp;
const r = await completeMissionLocal(db, alvo.id);
ok("devolve o XP ganho", r?.gainedXp === alvo.xp, JSON.stringify(r));
const depoisConcluir = (await loadGameData(db))!;
ok("XP creditado no banco local", depoisConcluir.character.xp === xpAntes + alvo.xp);
ok("atributo subiu", Object.entries(alvo.statGains).every(([k, v]) => (depoisConcluir.character.stats[k] ?? 0) >= v));
ok("missão ficou concluída", depoisConcluir.missions.find((m) => m.id === alvo.id)?.status === "done");

let fila = await pendingOps(db);
const opConclusao = fila.find((o) => o.type === "mission.complete");
ok("enfileirou mission.complete", Boolean(opConclusao));
ok("guardou a base para detectar conflito", JSON.parse(opConclusao!.base ?? "{}").status === "pending", opConclusao?.base ?? "");
ok("opId é único por operação", new Set(fila.map((o) => o.opId)).size === fila.length);

ok("concluir de novo não credita nada", (await completeMissionLocal(db, alvo.id)) === null);
ok("XP segue igual", (await loadGameData(db))!.character.xp === xpAntes + alvo.xp);

const desfez = await uncompleteMissionLocal(db, alvo.id);
ok("desfazer reverte o XP", desfez && (await loadGameData(db))!.character.xp === xpAntes);

secao("arco fechado não aceita conclusão (mesma regra do servidor)");
await db.runAsync("UPDATE weeks SET status = 'closed' WHERE id = 2");
ok("missão de arco fechado é recusada localmente", (await completeMissionLocal(db, alvo.id)) === null);
await db.runAsync("UPDATE weeks SET status = 'active' WHERE id = 2");

secao("atacar chefão");
const pagou = await payDebtLocal(db, 1, 200);
const comPagamento = (await loadGameData(db))!;
ok("pagamento entra no total pago", pagou && comPagamento.debts.find((d) => d.id === 1)?.paid === 1350, String(comPagamento.debts.find((d) => d.id === 1)?.paid));
const opPag = (await pendingOps(db, 100)).find((o) => o.type === "payment.create");
ok("enfileirou payment.create com clientUuid", Boolean(JSON.parse(opPag?.payload ?? "{}").clientUuid));
const linhasPag = await db.getAllAsync<{ id: number }>("SELECT id FROM payments WHERE debtId = 1 ORDER BY id ASC");
ok("linha criada no celular usa id negativo", linhasPag[0].id < 0, JSON.stringify(linhasPag));

await payDebtLocal(db, 2, 700); // quita o notebook (3500 + 700 = 4200)
const quitado = (await loadGameData(db))!.debts.find((d) => d.id === 2);
ok("chefão zerado vira derrotado", quitado?.status === "dead" && quitado.paid >= quitado.total, JSON.stringify(quitado));

secao("chefão novo pelo celular");
await createDebtLocal(db, { name: "Cadeira nova", total: 900, kind: "item" });
const comNovo = (await loadGameData(db))!;
ok("chefão aparece na lista", comNovo.debts.some((d) => d.name === "Cadeira nova"));
ok("com id negativo (só existe aqui até sincronizar)", (comNovo.debts.find((d) => d.name === "Cadeira nova")?.id ?? 1) < 0);

secao("freelas e settings");
await addExtraLocal(db, "Landing do salão", 450);
let comFreela = (await loadGameData(db))!;
ok("freela entra na lista", comFreela.extras.some((e) => e.name === "Landing do salão"));
const idFreela = comFreela.extras.find((e) => e.name === "Landing do salão")!.id;
ok("freela nasce com id (evita conflito de lista)", typeof idFreela === "string" && idFreela.length > 10);
await removeExtraLocal(db, idFreela);
comFreela = (await loadGameData(db))!;
ok("remover freela funciona pelo id", !comFreela.extras.some((e) => e.id === idFreela));

await putSettingLocal(db, "pouch", "2500");
ok("setting gravada localmente", (await loadGameData(db))!.settings.pouch === "2500");
const opSet = (await pendingOps(db, 100)).find((o) => o.type === "setting.put");
ok("setting.put enfileirada com a key certa", JSON.parse(opSet?.payload ?? "{}").key === "pouch");

secao("visita e streak");
await db.runAsync("DELETE FROM visits");
await markVisitLocal(db);
await markVisitLocal(db); // idempotente
const visitas = await db.getAllAsync<{ date: string }>("SELECT date FROM visits");
ok("visita do dia é única", visitas.length === 1);
const hoje = new Date();
const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
const iso = (d: Date) => d.toISOString().slice(0, 10);
ok("streak conta dias consecutivos", streakDe([iso(hoje), iso(ontem)]) === 2);
ok("streak quebra com buraco", streakDe([iso(hoje), "2020-01-01"]) === 1);

secao("conflito e descarte");
const algumaOp = (await pendingOps(db, 1))[0];
await markConflict(db, algumaOp.opId, {
  entity: "mission", entityId: "9", reason: "status_changed",
  mineLabel: "concluída (celular)", theirsLabel: "pendente no PC",
});
const emConflito = await db.getFirstAsync<{ status: string }>("SELECT status FROM outbox WHERE opId = ?", algumaOp.opId);
ok("operação em conflito sai da fila de envio", emConflito?.status === "conflict");
const conf = await db.getFirstAsync<{ mineLabel: string }>("SELECT mineLabel FROM conflicts WHERE opId = ?", algumaOp.opId);
ok("conflito guarda os dois lados para a tela", conf?.mineLabel === "concluída (celular)");
const pendentesDepois = await countPending(db);
const todas = await db.getAllAsync<{ n: number }>("SELECT COUNT(*) AS n FROM outbox");
ok("contador de pendentes ignora conflito", pendentesDepois < (todas[0]?.n ?? 0), `${pendentesDepois} de ${todas[0]?.n}`);

const outra = (await pendingOps(db, 1))[0];
await discard(db, outra.opId, "week_closed");
const descartada = await db.getFirstAsync<{ status: string; lastError: string }>(
  "SELECT status, lastError FROM outbox WHERE opId = ?", outra.opId
);
ok("descarte registra o motivo", descartada?.status === "discarded" && descartada.lastError === "week_closed");

console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
