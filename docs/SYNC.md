# Sincronização PC ↔ celular

Referência do protocolo entre o app Android e o servidor local. As **decisões** e o
histórico de por que cada peça existe estão em [PLANO-MOBILE.md](PLANO-MOBILE.md);
aqui é o contrato.

## O problema

O jogo mora numa máquina só, sem nuvem e sem conta. O celular precisa funcionar longe
dela — no ônibus, no elevador, no modo avião — e reencontrar o PC depois **sem perder o
que foi feito dos dois lados**. Não é replicação de banco: é uma conversa entre dois
lugares que podem discordar.

## Direções assimétricas

```
PC ──────► celular     snapshot incremental (o cowork edita tudo; o app reflete)
celular ──► PC          fila de operações   (o app produz eventos: concluí, paguei, anexei)
```

O PC é a fonte da verdade. O celular não inventa regra: ele registra intenções e o
servidor aplica com o **mesmo código** que o painel usa (`api/src/services/*`) — é o que
impede o XP de divergir entre as duas telas.

## Divisão de responsabilidades

| O celular faz | O celular nunca faz |
|---|---|
| concluir/desfazer missão, anexar e remover provas | criar arco, fechar arco, dar estrelas |
| atacar chefão, criar chefão | escrever briefing, editar títulos |
| salário, bolsa, freelas, avatar, check-in diário | criar ou editar missões, mudar XP |

Fechar a semana depende de julgamento com as provas na mão — é o ritual de domingo, no
PC, com o cowork. O servidor **recusa** essas operações mesmo se um app futuro tentar.

## Autenticação e alcance

- Pareamento por QR gerado no painel: `{"v":1,"host":"192.168.0.14","port":4000,"token":"…"}`.
- Token de 32 bytes numa Setting escondida (`sync_token`); `GET /api/settings` **filtra**
  essa chave e `PUT` nela é bloqueado.
- Todas as rotas `/api/sync/*` exigem `Authorization: Bearer <token>` — exceto `info` e
  `pair/new`, que são do painel local (quem alcança o painel já tem tudo).
- Comparação do token por digest SHA-256 + `timingSafeEqual`: o tempo de resposta não
  entrega nem o valor nem o tamanho.
- Limite de 120 requisições/minuto por aparelho.
- No app o token vive no **SecureStore** (criptografado pelo Android), nunca no SQLite.

## Endpoints

| Método | Rota | Token | Papel |
|---|---|:--:|---|
| GET | `/api/sync/info` | — | IPs da máquina, porta, aparelhos pareados |
| POST | `/api/sync/pair/new` | — | gera token novo (desconecta todos os aparelhos) |
| GET | `/api/sync/ping` | ✓ | alcance + versão do APK publicado |
| POST | `/api/sync/hello` | ✓ | registra o aparelho |
| GET | `/api/sync/pull?since=<ISO>` | ✓ | mudanças desde o cursor |
| POST | `/api/sync/push` | ✓ | aplica operações do celular |
| POST | `/api/sync/attachments` | ✓ | upload de prova (multipart) |

## Pull — como o servidor sabe o que mudou

Cursor é o **relógio do servidor** (nunca o do celular). Cada modelo tem `updatedAt`,
escrito pelo Prisma em qualquer caminho de escrita — inclusive nas missões criadas
aninhadas dentro de `week.create`.

```
WHERE updatedAt >= (cursor − 2s)
```

A sobreposição de 2 s evita perder escritas no mesmo instante do cursor; reentregar linha
é inofensivo porque o app aplica por `upsert` no id do servidor.

Deleção não deixa `updatedAt`, então vira **lápide** (`Tombstone`), gravada pelos poucos
serviços que apagam algo. **Cascatas não geram lápide**: o banco do app repete as mesmas
FKs `ON DELETE CASCADE`, então apagar a missão apaga as provas dos dois lados por
construção (o app liga `PRAGMA foreign_keys = ON`).

> ⚠️ Armadilha do SQLite, já resolvida: o Prisma grava `DateTime` como INTEGER, mas
> `prisma db push` preenche coluna nova em linhas existentes com TEXT — e o SQLite ordena
> INTEGER antes de TEXT, fazendo `updatedAt >= cursor` casar com **tudo**.
> `repairLegacyDateTimes()` normaliza isso no start.

## Push — operações

```jsonc
POST /api/sync/push
{ "deviceId": "…", "ops": [ {
    "opId": "uuid-do-aparelho",          // idempotência: nunca muda em reenvio
    "type": "mission.complete",
    "base": { "updatedAt": "…", "status": "pending" },  // o que o app viu ao agir
    "payload": { "missionId": 9 },
    "force": false                        // true = "usei meu lado" na tela de conflito
} ] }
```

Tipos aceitos (lista fechada no servidor): `mission.complete`, `mission.uncomplete`,
`payment.create`, `debt.create`, `extra.add`, `extra.remove`, `setting.put`,
`visit.mark`, `attachment.delete`. Qualquer outro volta `rejected: forbidden_op`.

`setting.put` só aceita `income_current`, `pouch`, `pouch_goal`, `avatar`.

### Resultado por operação

| Status | Significa | O app faz |
|---|---|---|
| `applied` | aplicado (ou já estava, com `replay: true`) | tira da fila |
| `conflict` | o PC discorda; **nada foi escrito** | guarda para a tela de conflitos |
| `rejected` | regra do jogo (`week_closed`, `not_found`, `forbidden_op`) | descarta e força pull completo |

**Idempotência:** `applied` e `rejected` viram linha em `SyncOp`; reenviar o mesmo `opId`
devolve a resposta guardada sem tocar no banco. É o que impede a mesma missão de creditar
XP duas vezes quando o envio repete. Conflito **não** é memorizado — o estado do PC pode
ter mudado, então é reavaliado a cada tentativa.

## Conflitos

| Operação | Conflita quando | Saída |
|---|---|---|
| `mission.*` | a linha no PC foi tocada depois do `base.updatedAt` **e** o status atual ≠ o desejado | escolha do usuário |
| `setting.put` | o valor mudou no PC depois da foto do celular | escolha do usuário |
| `payment.create` | mesmo chefão, mesmo valor, dentro de 24 h | "manter os dois" ou "manter um" |
| `debt.create` | já existe chefão ativo com o mesmo nome | escolha |
| `attachment.*`, `extra.*`, `visit.mark` | nunca (append-only ou fusão por id) | automático |

O servidor devolve os dois lados **já em texto pt-BR** (`"R$ 137,50 · Nubank (celular)"`
× `"R$ 137,50 · 26/07 12:40 (PC)"`); a tela do app só renderiza.

Resolver:
- **usar celular** → a operação volta à fila com `force` e `opId` derivado (`…#force`).
  Reusar o id original faria o servidor devolver a resposta guardada em vez de aplicar.
- **usar PC** → descarta a operação e pede **pull completo**. Só descartar não bastaria:
  o espelho local ainda tem a versão do celular e o pull incremental não traria a linha
  de volta (no PC nada mudou).

Enquanto o conflito está aberto, o pull **não sobrescreve** aquela linha (nem o
personagem, se o conflito for de missão). Sua versão continua na tela até você decidir.

## Ids provisórios

Chefão e pagamento criados offline nascem com **id negativo** (`-1`, `-2`, …): nunca
colidem com os ids do servidor e são óbvios de reconhecer. Ao subir, o servidor devolve o
id real e o app **remapeia** a linha local (com `PRAGMA defer_foreign_keys` para o pai
poder trocar de id sem quebrar a FK do filho no meio da transação).

Como "criei o chefão e paguei ele antes de sincronizar" depende dessa tradução, o push
roda em até **3 passes** por rodada: a operação cujo id ainda não foi resolvido espera o
passe seguinte, na mesma sincronização.

## Uma rodada de sincronização

```
ping (2,5 s de paciência)
  └─ falhou → estado "offline", nada se perde
push (lotes de 25, em ordem, até 3 passes)
provas pendentes (uma por vez; confirmada, o arquivo cheio é apagado do aparelho)
pull (cursor, ou completo se houve recusa/“usei o PC”)
```

**Push antes de pull, sempre.** Ao contrário, o pull sobrescreveria a missão recém-
concluída e o app "desfaria" na frente do usuário.

Disparo: ao abrir/voltar ao app, a cada 5 minutos e no botão manual. Conflito nunca é
resolvido automaticamente.

## Provas

Imagem é reduzida (1920px, JPEG 85%) e gravada em **dois arquivos**: o cheio, que sobe e
é apagado quando o servidor confirma, e uma **miniatura de 256px** que fica no aparelho
para sempre — sem ela a prova só apareceria com o PC ao alcance. Ao receber a linha do
servidor, a miniatura é herdada pela linha nova.

Idempotência em duas camadas: `opId` (tabela `SyncOp`) e `clientUuid` único na tabela
`Attachment`. Prova recusada por tamanho (413) sai da fila em vez de tentar para sempre.

**Linha e arquivo nascem e morrem juntos.** Os dois caminhos de upload — o do painel
(`POST /api/missions/:id/attachments`) e o do celular (`POST /api/sync/attachments`) —
passam pelo mesmo `addAttachment`, que só cria a linha depois de conferir que o arquivo
está em `data/uploads/` com o tamanho anunciado. Não estando, o arquivo é descartado e a
resposta é `500 upload_failed` — o celular mantém a prova na fila e tenta de novo. Na
exclusão a ordem é a inversa: a linha sai primeiro, o arquivo depois.

O motivo é o custo assimétrico: arquivo sem linha é lixo invisível, mas **linha sem arquivo
é prova quebrada** — conta no painel, responde 410 no download e a revisão de domingo a lê
como "sem prova", rebaixando a missão a 3★. Quando algo tem que sobrar, que sobre o lixo.

Provas quebradas por perda de arquivo fora da API (backup restaurado pela metade, limpeza
manual) não são evitáveis dentro do fluxo, então ficam visíveis: `missing: true` em cada
`Attachment`, aviso vermelho no painel e `GET /api/attachments/orphans` com o relatório —
inclusive `backupPath`, que aponta a cópia em `backups/` quando os bytes ainda existem.
`POST /api/attachments/orphans/cleanup` apaga as linhas quebradas com lápide (o celular
esquece no pull seguinte) e nunca toca nos arquivos órfãos.

## Testes

```bash
cd mobile
npm run test:db      # 47 testes do banco local (SQLite do Node, sem emulador)
npm run test:sync    # 53 testes ponta a ponta contra o servidor real
```

O `test:sync` exige a API rodando em `127.0.0.1:4123` apontando para uma **cópia** do
banco. Ele exercita o motor real do app falando HTTP com o Express real — é o que pega
desencontro de contrato entre as duas pontas, incluindo os bytes da prova chegando
inteiros ao disco.
