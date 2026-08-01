// Teste de ponta a ponta do sync: o motor REAL do app (src/sync/*) falando com o servidor
// REAL do projeto por HTTP. É o que pega desencontro de contrato entre as duas pontas —
// nome de campo, formato de data, id que não existe do outro lado.
//
// Antes de rodar: subir a API em 127.0.0.1:4123 apontando para uma CÓPIA do banco.
import { createRequire } from "node:module";
import { abrirBancoDeTeste } from "./sqlite-adapter";
import { migrate } from "@/db/schema";
import { loadGameData, getSyncState } from "@/db/repo";
import { pendingOps } from "@/db/outbox";
import { completeMissionLocal, createDebtLocal, payDebtLocal, addExtraLocal } from "@/db/mutations";
import { salvarPareamento, trocarHost } from "@/sync/pairing";
import { sincronizar } from "@/sync/engine";
import { resolver } from "@/db/conflicts";

/** pega o opId do primeiro (e único) conflito da lista */
const conflitos0 = (linhas: { opId: string }[]) => linhas[0]?.opId ?? "";

const BASE = "http://127.0.0.1:4123";
// Onde o servidor de teste grava as provas. Precisa ser conhecido aqui porque parte do que
// se testa é justamente o desencontro entre a linha no banco e os bytes no disco.
const UPLOADS = process.env.TEST_UPLOAD_DIR ?? "C:/Users/rodri/Projetos/upgrade-pessoal/data/uploads";
const requireFromApi = createRequire("C:/Users/rodri/Projetos/upgrade-pessoal/api/package.json");
const { PrismaClient } = requireFromApi("@prisma/client");
const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
const ok = (nome: string, cond: boolean, extra = "") => {
  if (cond) { pass++; console.log(`  PASS  ${nome}`); }
  else { fail++; console.log(`  FAIL  ${nome}${extra ? ` — ${extra}` : ""}`); }
};
const secao = (t: string) => console.log(`\n== ${t} ==`);

// ── preparo: parear com o servidor ──
const { token } = await (await fetch(`${BASE}/api/sync/pair/new`, { method: "POST" })).json();

const db = abrirBancoDeTeste();
await migrate(db);
await salvarPareamento(db, { host: "127.0.0.1", port: 4123, token });

secao("primeira sincronização (aparelho zerado)");
ok("banco local começa vazio", (await loadGameData(db)) === null);

let r = await sincronizar(db);
ok("sincronizou sem erro", r.estado === "ok", JSON.stringify(r));
ok("baixou dados", r.baixou);

const jogo = await loadGameData(db);
ok("personagem chegou no celular", Boolean(jogo?.character.name), jogo?.character.name);
ok("missões chegaram", (jogo?.missions.length ?? 0) > 0, String(jogo?.missions.length));
ok("guardou o cursor do servidor", Boolean(await getSyncState(db, "cursor")));
ok("aparelho aparece no painel", Boolean(await prisma.device.findFirst()));

secao("concluir offline e subir (o XP não pode duplicar)");
const alvo = jogo!.missions.find((m) => m.status === "pending" && m.weekId === jogo!.weeks.find((w) => w.status === "active")!.id)!;
const charAntes = await prisma.character.findUnique({ where: { id: 1 } });

await completeMissionLocal(db, alvo.id);
ok("operação ficou na fila antes da rede", (await pendingOps(db)).length === 1);

r = await sincronizar(db);
ok("enviou 1 operação", r.enviadas === 1, JSON.stringify(r));
ok("fila esvaziou", (await pendingOps(db)).length === 0);

const missaoNoServidor = await prisma.mission.findUnique({ where: { id: alvo.id } });
ok("missão ficou concluída no PC", missaoNoServidor.status === "done");
const charDepois = await prisma.character.findUnique({ where: { id: 1 } });
ok("XP creditado uma vez no PC", charDepois.xp === charAntes.xp + alvo.xp, `${charAntes.xp} + ${alvo.xp} != ${charDepois.xp}`);

r = await sincronizar(db);
const charFinal = await prisma.character.findUnique({ where: { id: 1 } });
ok("sincronizar de novo não credita nada", charFinal.xp === charDepois.xp, `${charFinal.xp}`);

secao("criar chefão e pagar ANTES de sincronizar (remapeamento de id)");
await createDebtLocal(db, { name: "Chefão offline", total: 500, kind: "debt" });
const chefaoLocal = (await loadGameData(db))!.debts.find((d) => d.name === "Chefão offline")!;
ok("chefão nasce com id negativo", chefaoLocal.id < 0, String(chefaoLocal.id));

await payDebtLocal(db, chefaoLocal.id, 120);
ok("pagamento apontando para o id provisório", (await pendingOps(db, 10)).length === 2);

r = await sincronizar(db);
ok("as duas operações subiram", r.enviadas === 2, JSON.stringify(r));

const noServidor = await prisma.debt.findFirst({ where: { name: "Chefão offline" }, include: { payments: true } });
ok("chefão existe no PC", Boolean(noServidor));
ok("o pagamento achou o dono certo", noServidor.payments.length === 1 && noServidor.payments[0].amount === 120, JSON.stringify(noServidor?.payments));

const depoisRemap = (await loadGameData(db))!.debts.find((d) => d.name === "Chefão offline")!;
ok("id local virou o id do servidor", depoisRemap.id === noServidor.id, `${depoisRemap.id} vs ${noServidor.id}`);
ok("o pagamento local seguiu junto", depoisRemap.paid === 120, String(depoisRemap.paid));

secao("conflito: o PC mexeu depois de mim");
const outra = (await loadGameData(db))!.missions.find((m) => m.status === "pending")!;
// o celular age com a foto atual…
await completeMissionLocal(db, outra.id);
// …e o PC toca a mesma linha depois disso
await new Promise((s) => setTimeout(s, 1100));
await prisma.mission.update({ where: { id: outra.id }, data: { title: outra.title } });

r = await sincronizar(db);
ok("virou conflito, não sobrescreveu", r.conflitos === 1, JSON.stringify(r));
const conflitos = await db.getAllAsync<{ mineLabel: string; theirsLabel: string }>("SELECT * FROM conflicts");
ok("conflito guardado com os dois lados", conflitos.length === 1 && conflitos[0].mineLabel.length > 0 && conflitos[0].theirsLabel.length > 0, JSON.stringify(conflitos));
const missaoConflito = await prisma.mission.findUnique({ where: { id: outra.id } });
ok("o PC continua com a versão dele", missaoConflito.status === "pending");
ok("a operação saiu da fila de envio", (await pendingOps(db)).length === 0);

secao("resolver conflito: 'usar celular' aplica à força");
await resolver(db, conflitos0(await db.getAllAsync<{ opId: string }>("SELECT opId FROM conflicts")), "celular");
r = await sincronizar(db);
ok("a operação forçada subiu", r.enviadas === 1, JSON.stringify(r));
const missaoForcada = await prisma.mission.findUnique({ where: { id: outra.id } });
ok("o PC aceitou a versão do celular", missaoForcada.status === "done", missaoForcada.status);
ok("lista de conflitos esvaziou", (await db.getAllAsync("SELECT * FROM conflicts")).length === 0);

secao("resolver conflito: 'usar PC' descarta e traz a verdade de lá");
const terceira = (await loadGameData(db))!.missions.find((m) => m.status === "pending")!;
await completeMissionLocal(db, terceira.id);
await new Promise((s) => setTimeout(s, 1100));
await prisma.mission.update({ where: { id: terceira.id }, data: { title: terceira.title } });
r = await sincronizar(db);
ok("gerou o conflito", r.conflitos === 1, JSON.stringify(r));
ok("no celular a missão ainda aparece concluída", (await loadGameData(db))!.missions.find((m) => m.id === terceira.id)!.status === "done");

await resolver(db, conflitos0(await db.getAllAsync<{ opId: string }>("SELECT opId FROM conflicts")), "pc");
r = await sincronizar(db);
const depoisDoPc = (await loadGameData(db))!;
ok("o celular volta para a versão do PC", depoisDoPc.missions.find((m) => m.id === terceira.id)!.status === "pending");
ok("XP do celular bate com o do PC", depoisDoPc.character.xp === (await prisma.character.findUnique({ where: { id: 1 } })).xp, `${depoisDoPc.character.xp}`);
ok("nada ficou preso na fila", (await pendingOps(db)).length === 0);
ok("conflitos zerados", (await db.getAllAsync("SELECT * FROM conflicts")).length === 0);

secao("arco fechado: operação recusada, não fica tentando para sempre");
const arco = await prisma.week.findFirst({ where: { status: "active" } });
const maisUma = (await loadGameData(db))!.missions.find((m) => m.status === "pending" && m.id !== outra.id)!;
await completeMissionLocal(db, maisUma.id);
const opRecusada = (await pendingOps(db, 1))[0].opId;
await prisma.week.update({ where: { id: arco.id }, data: { status: "closed" } });

r = await sincronizar(db);
ok("servidor recusou", r.recusadas === 1, JSON.stringify(r));
const recusada = await db.getFirstAsync<{ status: string; lastError: string }>(
  "SELECT status, lastError FROM outbox WHERE opId = ?",
  opRecusada
);
ok("motivo registrado como week_closed", recusada?.lastError === "week_closed", JSON.stringify(recusada));
const depoisDoPull = (await loadGameData(db))!.missions.find((m) => m.id === maisUma.id)!;
ok("o pull desfez o que o app tinha assumido", depoisDoPull.status === "pending", depoisDoPull.status);
await prisma.week.update({ where: { id: arco.id }, data: { status: "active" } });

secao("provas: anexar offline e subir depois");
const { File } = await import("expo-file-system");
const { anexarProvaLocal, listarProvas, contarProvasPendentes, removerProvaLocal } = await import("@/db/proofs");

const arquivo = new File(`${(await import("node:os")).tmpdir()}/prova-teste.txt`);
arquivo.write("conteúdo da prova de teste");

const missaoDaProva = (await loadGameData(db))!.missions.find((m) => m.weekId === arco.id)!;
const clientUuidProva = "prova-teste-" + Date.now();
await anexarProvaLocal(db, missaoDaProva.id, {
  clientUuid: clientUuidProva,
  uri: arquivo.uri,
  thumbUri: null,
  originalName: "prova-teste.txt",
  mimeType: "text/plain",
  size: arquivo.size,
});

let provasLocais = await listarProvas(db, missaoDaProva.id);
ok("prova aparece na hora com id negativo", provasLocais.some((p) => p.id < 0), JSON.stringify(provasLocais.map((p) => p.id)));
ok("arquivo entrou na fila de upload", (await contarProvasPendentes(db)) === 1);

r = await sincronizar(db);
ok("upload contou como envio", r.enviadas >= 1, JSON.stringify(r));
ok("fila de arquivos esvaziou", (await contarProvasPendentes(db)) === 0);

const provaNoServidor = await prisma.attachment.findUnique({ where: { clientUuid: clientUuidProva } });
ok("prova chegou no PC", Boolean(provaNoServidor), String(provaNoServidor?.originalName));
ok("ligada à missão certa", provaNoServidor?.missionId === missaoDaProva.id);

provasLocais = await listarProvas(db, missaoDaProva.id);
ok("a linha local virou a do servidor (id positivo)", provasLocais.some((p) => p.id === provaNoServidor.id));
ok("nenhuma linha negativa sobrou", !provasLocais.some((p) => p.id < 0), JSON.stringify(provasLocais.map((p) => p.id)));
ok("arquivo cheio saiu do aparelho", !arquivo.exists);

// o conteúdo em si chegou? (linha no banco não é o mesmo que bytes no disco)
const baixado = await (await fetch(`${BASE}/api/attachments/${provaNoServidor.id}/download`)).text();
ok("os bytes da prova chegaram inteiros", baixado === "conteúdo da prova de teste", JSON.stringify(baixado.slice(0, 40)));

// reenvio do mesmo upload não pode duplicar (idempotência por opId no servidor)
const quantasAntes = await prisma.attachment.count({ where: { missionId: missaoDaProva.id } });
r = await sincronizar(db);
ok("sincronizar de novo não duplica a prova", (await prisma.attachment.count({ where: { missionId: missaoDaProva.id } })) === quantasAntes);

const { arquivoParaApagar } = await removerProvaLocal(db, provaNoServidor.id);
r = await sincronizar(db);
ok("remover prova no celular apaga no PC também", (await prisma.attachment.findUnique({ where: { id: provaNoServidor.id } })) === null, JSON.stringify(arquivoParaApagar));

secao("prova quebrada: linha no banco sem arquivo no disco");
const fsNode = await import("node:fs");
const pathNode = await import("node:path");

// Sobe uma prova de verdade e depois arranca o arquivo por baixo dela — é assim que a
// prova quebrada aparece no mundo real (arquivo perdido fora do fluxo da API).
const uuidQuebrada = "prova-quebrada-" + Date.now();
const arquivoQuebrado = new File(`${(await import("node:os")).tmpdir()}/prova-quebrada.txt`);
arquivoQuebrado.write("prova que vai perder o arquivo");
await anexarProvaLocal(db, missaoDaProva.id, {
  clientUuid: uuidQuebrada,
  uri: arquivoQuebrado.uri,
  thumbUri: null,
  originalName: "prova-quebrada.txt",
  mimeType: "text/plain",
  size: arquivoQuebrado.size,
});
await sincronizar(db);

const quebrada = await prisma.attachment.findUnique({ where: { clientUuid: uuidQuebrada } });
ok("prova subiu antes de quebrar", Boolean(quebrada), String(quebrada?.originalName));
fsNode.rmSync(pathNode.join(UPLOADS, quebrada.filename));

const arcoComQuebrada = await (await fetch(`${BASE}/api/weeks/active`)).json();
const missaoComQuebrada = arcoComQuebrada.missions.find((m: { id: number }) => m.id === missaoDaProva.id);
const anexoNaView = missaoComQuebrada.attachments.find((a: { id: number }) => a.id === quebrada.id);
ok("a API marca a prova como missing", anexoNaView?.missing === true, JSON.stringify(anexoNaView));
ok(
  "prova inteira não é marcada como missing",
  missaoComQuebrada.attachments.every((a: { id: number; missing: boolean }) => a.id === quebrada.id || !a.missing),
  JSON.stringify(missaoComQuebrada.attachments)
);

const respDownload = await fetch(`${BASE}/api/attachments/${quebrada.id}/download`);
const corpoDownload = await respDownload.json();
ok("download responde 410 com código", respDownload.status === 410 && corpoDownload.code === "file_missing", JSON.stringify(corpoDownload));

const relatorio = await (await fetch(`${BASE}/api/attachments/orphans`)).json();
ok("relatório lista a prova quebrada", relatorio.rows.some((o: { id: number }) => o.id === quebrada.id), JSON.stringify(relatorio.rows));
ok(
  "relatório diz de qual missão é",
  relatorio.rows.find((o: { id: number }) => o.id === quebrada.id)?.missionTitle === missaoDaProva.title,
  JSON.stringify(relatorio.rows)
);
ok("nenhum arquivo ficou sem dono", relatorio.files.length === 0, JSON.stringify(relatorio.files));

const limpeza = await (await fetch(`${BASE}/api/attachments/orphans/cleanup`, { method: "POST" })).json();
ok("limpeza removeu a linha quebrada", limpeza.removed.some((o: { id: number }) => o.id === quebrada.id), JSON.stringify(limpeza));
ok("a linha saiu do banco", (await prisma.attachment.findUnique({ where: { id: quebrada.id } })) === null);
ok("virou lápide (o celular vai esquecer também)", Boolean(await prisma.tombstone.findFirst({ where: { entity: "attachment", entityId: String(quebrada.id) } })));

r = await sincronizar(db);
const semQuebrada = await db.getFirstAsync("SELECT id FROM attachments WHERE id = ?", quebrada.id);
ok("o celular apagou a prova quebrada no pull", semQuebrada === null, JSON.stringify(semQuebrada));

secao("upload que não chega inteiro ao disco não cria linha");
// Corpo multipart que anuncia mais bytes do que envia: a conexão morre no meio, como um
// Wi-Fi que cai com a prova subindo.
const antesDoTruncado = await prisma.attachment.count({ where: { missionId: missaoDaProva.id } });
const limite = "----upgrade" + Date.now();
const cabeca =
  `--${limite}\r\nContent-Disposition: form-data; name="files"; filename="cortada.txt"\r\n` +
  `Content-Type: text/plain\r\n\r\n`;
const corpoCompleto = cabeca + "bytes que nunca vão chegar por inteiro\r\n" + `--${limite}--\r\n`;

let cortou = false;
try {
  await fetch(`${BASE}/api/missions/${missaoDaProva.id}/attachments`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${limite}`,
      "Content-Length": String(Buffer.byteLength(corpoCompleto)),
    },
    // manda só o começo e fecha o socket: o servidor fica esperando o resto
    body: new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(corpoCompleto.slice(0, cabeca.length + 10)));
        c.error(new Error("conexão cortada no meio da prova"));
      },
    }),
    duplex: "half",
  } as RequestInit);
} catch {
  cortou = true;
}
ok("a requisição realmente morreu no meio", cortou);
ok(
  "upload cortado não deixou linha no banco",
  (await prisma.attachment.count({ where: { missionId: missaoDaProva.id } })) === antesDoTruncado,
  `${antesDoTruncado} antes`
);
const sobrasNoDisco = await (await fetch(`${BASE}/api/attachments/orphans`)).json();
ok("nem prova quebrada nem arquivo perdido depois do corte", sobrasNoDisco.rows.length === 0 && sobrasNoDisco.files.length === 0, JSON.stringify(sobrasNoDisco));

secao("lote recusado não deixa arquivo perdido no disco");
// O multer grava os DOIS arquivos antes de o handler rodar. Recusada a missão, nenhum dos
// dois pode ficar em data/uploads — sem linha que os aponte, ninguém os acharia de novo.
const lote = new FormData();
lote.append("files", new Blob(["prova um"], { type: "text/plain" }), "um.txt");
lote.append("files", new Blob(["prova dois"], { type: "text/plain" }), "dois.txt");
const resp404 = await fetch(`${BASE}/api/missions/999999/attachments`, { method: "POST", body: lote });
ok("missão inexistente recusa o lote", resp404.status === 404, String(resp404.status));
const depoisDoLote = await (await fetch(`${BASE}/api/attachments/orphans`)).json();
ok("nenhum dos dois arquivos sobrou", depoisDoLote.files.length === 0, JSON.stringify(depoisDoLote.files));

secao("guarda do upload: linha só nasce com arquivo inteiro no disco");
// Único bloco que fala com o servidor por dentro: a garantia é contra falha de disco, e
// disco cheio / arquivo truncado não se provoca por HTTP.
process.env.UPLOAD_DIR = UPLOADS;
const uploadsLib = requireFromApi("./src/lib/uploads.ts");
const attService = requireFromApi("./src/services/attachments.service.ts");

const meioArquivo = pathNode.join(UPLOADS, "meio-arquivo-teste.txt");
fsNode.writeFileSync(meioArquivo, "12345");
ok("recusa arquivo que nunca existiu", (await uploadsLib.uploadWritten("nunca-existiu.txt", 5)) === false);
ok("recusa arquivo menor que o anunciado", (await uploadsLib.uploadWritten("meio-arquivo-teste.txt", 10)) === false);
ok("aceita arquivo do tamanho certo", (await uploadsLib.uploadWritten("meio-arquivo-teste.txt", 5)) === true);
fsNode.rmSync(meioArquivo);

// arquivo que o multer JURA ter gravado, mas que não está lá
const antesDaGuarda = await prisma.attachment.count({ where: { missionId: missaoDaProva.id } });
let codigoRecusa = "";
try {
  await attService.addAttachment(missaoDaProva.id, {
    filename: `fantasma-${Date.now()}.txt`,
    originalname: "fantasma.txt",
    mimetype: "text/plain",
    size: 42,
  });
} catch (e) {
  codigoRecusa = (e as { code?: string }).code ?? (e as Error).message;
}
ok("addAttachment recusa arquivo ausente", codigoRecusa === "upload_failed", codigoRecusa);
ok(
  "e não criou linha nenhuma",
  (await prisma.attachment.count({ where: { missionId: missaoDaProva.id } })) === antesDaGuarda,
  `${antesDaGuarda} antes`
);

secao("sem PC ao alcance");
await trocarHost(db, "10.255.255.1", 4123); // endereço que não responde
await addExtraLocal(db, "Freela do modo avião", 300);
r = await sincronizar(db);
ok("estado vira offline", r.estado === "offline", JSON.stringify(r));
ok("a operação continua guardada", (await pendingOps(db)).length === 1);

await trocarHost(db, "127.0.0.1", 4123);
r = await sincronizar(db);
ok("ao voltar para a rede, sobe o que ficou", r.enviadas === 1, JSON.stringify(r));
const extras = JSON.parse((await prisma.setting.findUnique({ where: { key: "extras" } })).value);
ok("freela do modo avião chegou no PC", extras.some((e: { name: string }) => e.name === "Freela do modo avião"));

secao("token inválido");
await salvarPareamento(db, { host: "127.0.0.1", port: 4123, token: "token-errado" });
r = await sincronizar(db);
ok("avisa que o pareamento expirou", r.estado === "erro" && /pareamento/i.test(r.mensagem ?? ""), JSON.stringify(r));

await prisma.$disconnect();
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} passaram, ${fail} falharam\n`);
process.exit(fail === 0 ? 0 : 1);
