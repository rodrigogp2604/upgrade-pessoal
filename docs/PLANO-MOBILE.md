# Plano de ação — App mobile (Android, offline-first)

> Documento de decisões e roteiro de execução. Nada aqui está em aberto: toda escolha
> já foi travada. Se algo mudar, **edite este arquivo** antes de mudar o código.
>
> Base: protótipo `Upgrade Pessoal Mobile.dc.html` (Claude Design, projeto `6a836c91`).
> Data: 26/07/2026.

---

## 1. Objetivo

Um APK Android que funciona **100% offline** para o dia a dia do jogo (concluir missões,
anexar provas, atacar chefões, lançar renda) e que, quando o celular está **na mesma rede
do PC** (ou ligado nele), **sincroniza com o servidor local** do `upgrade-pessoal`
(`localhost:4000` / Docker) nos dois sentidos, com **resolução manual de conflitos**.

O ritual semanal continua sendo feito **com o cowork (Claude) no PC**. O app é o "campo",
o PC é a "base".

---

## 2. Escopo — o que o app faz e o que ele nunca faz

### ✅ O app FAZ (offline, entra na fila de sincronização)

| Ação | Entidade tocada |
|---|---|
| Concluir / desfazer missão do arco ativo | `Mission.status` (+XP, +atributos) |
| Anexar prova (câmera, galeria, arquivo) | `Attachment` (upload binário) |
| Remover prova que ainda não subiu | `Attachment` |
| Atacar chefão (registrar pagamento) | `Payment` |
| Criar chefão novo (dívida ou item) | `Debt` |
| Adicionar / remover freela ("ganho por fora") | Setting `extras` |
| Editar salário | Setting `salary` |
| Ajustar bolsa de ouro e a meta | Settings `pouch`, `pouch_goal` |
| Trocar a foto do personagem | Setting `avatar` |
| Check-in diário (streak) | `Visit` |

### ✅ O app MOSTRA (somente leitura, vem do PC)

Personagem (nível, XP, título, atributos/radar), andar atual, arco ativo e suas missões,
histórico da Torre com estrelas e review, chefões, saúde financeira, escada de títulos.

### ❌ O app NUNCA faz (é do cowork, no PC)

- Criar arco / semana, criar ou editar missões, definir XP e ganhos de atributo.
- **Fechar arco e dar estrelas** (`/fechar-arco`).
- Escrever ou revisar briefing (`/briefing`), editar a escada de títulos.
- Reverter XP em massa, mexer em andar manualmente.

> Regra travada: **o servidor rejeita** qualquer op vinda do app que toque essas entidades,
> mesmo que uma versão futura do app tente. A whitelist de operações vive no backend.

Quando o arco ativo passar de 7 dias, o app mostra um aviso fixo:
**"Domingo chegou — feche o arco com o cowork no PC."** (não oferece botão de fechar).

---

## 3. Decisões travadas

| # | Decisão | Escolha | Por quê |
|---|---|---|---|
| D1 | Descoberta/pareamento | **QR Code no painel web + token** (fallback: digitar IP/token; botão "Procurar PC na rede" faz varredura do /24) | mDNS falha em muito roteador doméstico; QR é 1 toque e já entrega o segredo |
| D2 | Build do APK | **Expo + EAS Build (nuvem), profile `preview` → APK** | a máquina não tem Android SDK nem `ANDROID_HOME`; evita ~8 GB de instalação |
| D3 | Conflitos | **Tela de resolução registro a registro** (Celular vs PC, com "usar tudo do celular/PC") | nada é sobrescrito sem o usuário ver |
| D4 | Escopo de escrita mobile | Missões (concluir), provas, pagamentos, **criar chefões**, freelas/salário, bolsa, avatar/tema | resposta do usuário em 26/07/2026 |
| D5 | Estratégia de sync | **Outbox de operações (push) + pull incremental por cursor** | ações do app são eventos; evita merge cego de linhas e duplicação de XP |
| D19 | Datas legadas do SQLite | **`repairLegacyDateTimes()` roda no start** (`api/src/lib/repair-datetimes.ts`), convertendo `updatedAt` em TEXT para INTEGER | descoberto na Fase 2: o `db push` preenche coluna de data nova com TEXT, e o SQLite ordena INTEGER antes de TEXT — `updatedAt >= cursor` casava com **toda** linha antiga e o pull incremental voltava o banco inteiro. 36 linhas corrigidas no banco real |
| D20 | Chave do salário | o app escreve **`income_current`** (não `salary`) | é a key que o painel já usa; `income_start/checkpoint/target` vêm do briefing e o app não toca |
| D21 | Limite de requisições | **120/min por aparelho** (o plano dizia 30) | a primeira sincronização faz um upload por prova; 30 travaria um celular com 40 fotos |
| D18 | Cursor do pull | **`updatedAt` em cada modelo + tabela `Tombstone` para deleções** (revisado em 26/07/2026; antes era uma tabela `ChangeLog` alimentada por extension do Prisma) | a extension só enxerga a operação de topo: `week.create` com missões aninhadas (`weeks.ts`) e cascatas do SQLite passariam despercebidas. `updatedAt` é preenchido pelo próprio Prisma em qualquer caminho de escrita |
| D6 | Fonte da verdade | **PC sempre**, exceto pelas ops que o usuário resolver a favor do celular | o motor de regras é o `api/src/domain.ts` |
| D7 | Local do código | pasta `mobile/` no **mesmo repositório**, com `package.json` próprio, **fora** do `workspaces` do npm | o protocolo de sync é um contrato entre `api/` e `mobile/` — repos separados fazem as duas pontas derivarem; fora do workspace porque o Metro do Expo quebra com hoisting |
| D16 | Distribuição do APK | o **próprio servidor local serve o APK** em `data/apk/`; painel mostra QR de instalação. O binário **não vai para o git** | o celular já fala com o PC na porta 4000; instalar por cabo/e-mail é fricção desnecessária |
| D17 | Atualização do app | `/api/sync/ping` devolve a versão publicada; o app avisa "nova versão disponível" e abre o download | sem loja, o app precisa saber sozinho que envelheceu |
| D8 | Navegação | `expo-router` com **5 abas** iguais ao protótipo | espelha o design 1:1 |
| D9 | Estilo | **NativeWind v4** com os tokens do protótipo (claro + escuro) | pedido do usuário |
| D10 | Banco local | **expo-sqlite** com espelho das tabelas do servidor + tabelas de sync | offline real, não cache volátil |
| D11 | Regras de XP no app | **cópia** de `api/src/domain.ts` em `mobile/src/domain.ts` (feedback otimista); o pull do servidor sempre sobrescreve | app tem que celebrar na hora, sem rede |
| D12 | Tema claro/escuro | **não sincroniza** — é preferência do aparelho | cada tela tem sua luz |
| D13 | Gatilho do sync | automático ao abrir/voltar ao app e a cada 5 min quando o PC está alcançável + botão manual. **Conflito nunca é resolvido automaticamente** | |
| D14 | Autenticação | token `Bearer` obrigatório **só** em `/api/sync/*`; painel local segue sem login | não atrapalha o uso no PC |
| D15 | Provas grandes | comprime imagem (máx. 1920px / 85%) antes de guardar; após o upload confirmado, apaga o original do celular e mantém miniatura | 25 MB/arquivo é o limite do multer |

---

## 4. Arquitetura

```
┌─────────────────────── CELULAR (APK) ───────────────────────┐
│  UI (Expo Router + NativeWind)                              │
│        ↕ lê/escreve                                          │
│  SQLite local (espelho + outbox + conflitos)                │
│        ↕                                                     │
│  SyncEngine  ── push ops ──▶ ┐                              │
│              ◀── pull cursor ┤   HTTP + Bearer token         │
└──────────────────────────────┼──────────────────────────────┘
                               │  Wi-Fi local / USB (adb reverse)
┌──────────────────────────────┼──────────────────────────────┐
│  API Express  /api/sync/*    ▼                              │
│    ├── services/  (regras compartilhadas com as rotas HTTP) │
│    ├── ChangeLog  (sequência global → cursor do pull)       │
│    ├── SyncOp     (idempotência: uma op só aplica 1x)       │
│    └── Prisma / SQLite  data/upgrade.db + data/uploads      │
│  Painel web  → tela "Parear celular" (QR + token)           │
└─────────────────────────────────────────────────────────────┘
```

### Por que outbox e não "merge de tabelas"

As ações do app são **eventos** (concluí, paguei, anexei), não edições de texto. Tratando
como evento a gente ganha de graça: idempotência (não duplica XP se o push repetir),
ordem, e um motivo legível para mostrar na tela de conflito. O caminho inverso (PC → app)
é um **snapshot incremental**, porque lá o cowork edita tudo e o app só precisa refletir.

---

## 5. Mudanças no backend (`api/`)

### 5.1 Schema (migration Prisma)

```prisma
// lápide: a única mudança que o updatedAt não consegue contar
model Tombstone {
  id       Int      @id @default(autoincrement())
  entity   String   // mission | attachment | debt | payment | title | week
  entityId String   // id como texto (Setting usa a key)
  at       DateTime @default(now())
  @@index([at])
}

// idempotência do push: cada op do app aplica no máximo uma vez
model SyncOp {
  opId       String   @id       // uuid gerado no celular
  deviceId   String
  type       String
  status     String              // applied | rejected | conflict
  resultJson String?
  createdAt  DateTime @default(now())
}

model Device {
  id           String    @id      // uuid do aparelho
  name         String             // "Moto G do Rodrigo"
  lastPulledAt DateTime?          // cursor entregue no último pull
  lastSeen     DateTime  @updatedAt
}
```

Campos novos em modelos existentes:
- `updatedAt DateTime @updatedAt @default(now())` em **todos** os modelos sincronizados
  (`Week`, `Mission`, `Attachment`, `Title`, `Debt`, `Payment`, `Setting`, `Visit`, `Briefing`);
  `Character` já tinha.
- `clientUuid String? @unique` em `Payment` e `Attachment` (idempotência de criação).

### 5.2 Como o pull sabe o que mudou

`updatedAt` é escrito pelo próprio Prisma em **qualquer** caminho de escrita — inclusive nas
missões criadas aninhadas dentro de `week.create`, que uma extension de query não enxergaria.
O pull então é `WHERE updatedAt >= cursor` com **2 s de sobreposição** (evita perder escritas
no mesmo instante do cursor); reentregar uma linha é inofensivo porque o app aplica por
`upsert` no id do servidor.

Deleções não deixam `updatedAt`, então vão para `Tombstone`, gravado explicitamente pelos
poucos serviços que apagam algo (`deleteMission`, `deleteAttachment`, `deleteDebt`).
**Cascatas não geram tombstone**: o banco local do app repete as mesmas FKs
`ON DELETE CASCADE`, então apagar a missão apaga as provas nos dois lados por construção
(o app precisa de `PRAGMA foreign_keys=ON`).

Limite conhecido: edição feita direto no Prisma Studio ou no `.db` na mão não gera tombstone
ao deletar. Aceito e documentado — o caminho normal do cowork é a API HTTP.

### 5.3 Refatoração para serviços

Hoje a regra de negócio mora dentro dos handlers (ex.: `missions.ts:73` calcula XP,
atributos e level-up). Extrair para `api/src/services/`:

- `missions.service.ts` → `completeMission(id)`, `uncompleteMission(id)`
- `debts.service.ts` → `payDebt(debtId, amount, note, clientUuid)`, `createDebt(...)`
- `settings.service.ts` → `putSetting(key, value)` (com recálculo de saúde financeira)
- `attachments.service.ts`, `visits.service.ts`

As rotas HTTP atuais passam a chamar os serviços; **o push do sync chama os mesmos serviços**.
Assim o XP calculado pelo celular e pelo painel nunca divergem.

### 5.4 Endpoints novos (`api/src/routes/sync.ts`)

| Método | Rota | Token? | O quê |
|---|---|---|---|
| GET | `/api/sync/info` | não (só LAN/painel) | `{ lanIps[], port, tokenSet, deviceCount }` para montar o QR |
| POST | `/api/sync/pair/new` | não | gera token novo (32 bytes hex) em Setting `sync_token`; **invalida todos os pareamentos** |
| GET | `/api/sync/ping` | sim | `{ ok, serverName, serverId, apiVersion }` — teste de alcance |
| POST | `/api/sync/hello` | sim | registra/atualiza `Device`, devolve `cursor` conhecido |
| GET | `/api/sync/pull?since=<ISO>` | sim | linhas com `updatedAt >= since - 2s` + tombstones |
| POST | `/api/sync/push` | sim | aplica lista de ops |
| POST | `/api/sync/attachments` | sim | multipart: `file`, `opId`, `missionId`, `clientUuid` |
| GET | `/api/app/latest` | não | manifesto do APK publicado: `{ version, versionCode, builtAt, sizeBytes, sha256, url }` |
| GET | `/api/app/download` | não | envia o `.apk` de `data/apk/` com `Content-Type: application/vnd.android.package-archive` |

> `/api/app/*` fica **sem token de propósito**: a primeira instalação acontece antes de
> existir pareamento. Quem já está na LAN também já alcança o painel — o que o token
> protege é o **dado**, não o binário. `ping` passa a devolver `latestApp` para o D17.

**Segurança obrigatória:**
1. `GET /api/settings` passa a **filtrar a key `sync_token`** (hoje devolveria o segredo para
   qualquer um na rede). Item de correção, não opcional.
2. Comparação do token com `crypto.timingSafeEqual`.
3. 401 quando não há token configurado (pareamento nunca feito).
4. Limite de 30 req/min por device em `/api/sync/*`.

### 5.5 Formato do pull

```jsonc
GET /api/sync/pull            // sem `since` = primeira carga, traz tudo
{
  "cursor": "2026-07-26T18:04:11.812Z",   // hora do servidor no início da consulta
  "hasMore": false,
  "changes": {
    "character": { "id":1, "name":"…", "xp":1375, "stats":{…}, "updatedAt":"…" },
    "titles":   [ … ],
    "weeks":    [ { "id":2, "floor":14, "theme":"Sair da Invisibilidade", "status":"active", … } ],
    "missions": [ { "id":9, "weekId":2, "status":"pending", "xp":50, "statGains":{…}, "updatedAt":"…" } ],
    "attachments": [ { "id":4, "missionId":9, "originalName":"post.png", "url":"/api/attachments/4/download" } ],
    "debts":    [ … ], "payments": [ … ],
    "settings": [ { "key":"pouch", "value":"0", "updatedAt":"…" } ],   // sync_token nunca aparece
    "visits":   [ "2026-07-26" ],
    "briefing": { "id":3, "createdAt":"…" }                            // só metadado + texto
  },
  "deleted": { "mission": [7], "attachment": [2] }   // vem da tabela Tombstone
}
```

O app aplica em transação única e grava `cursor` em `sync_state`. Como o cursor é o relógio
**do servidor** (nunca o do celular), fuso e atraso do aparelho não afetam nada.

### 5.6 Formato do push

```jsonc
POST /api/sync/push
{
  "deviceId": "b1e2…",
  "ops": [
    { "opId":"7f2c…", "type":"mission.complete",
      "base":{ "updatedAt":"2026-07-26T12:00:00Z", "status":"pending" },
      "payload":{ "missionId": 9 } },
    { "opId":"91aa…", "type":"payment.create",
      "payload":{ "debtId":3, "amount":200, "note":"pix", "clientUuid":"c-1" } }
  ]
}
```

Resposta:

```jsonc
{
  "cursor": 815,
  "results": [
    { "opId":"7f2c…", "status":"applied", "gainedXp":50, "leveledUp":false },
    { "opId":"91aa…", "status":"conflict", "reason":"possible_duplicate",
      "entity":"payment", "id":3,
      "mine":  { "label":"R$ 200,00 · hoje 12:10 (celular)" },
      "theirs":{ "label":"R$ 350,00 · hoje 12:40 (PC)" },
      "serverUpdatedAt":"2026-07-26T12:40:00Z" }
  ]
}
```

Status possíveis: `applied` | `conflict` | `rejected` (com `reason` legível: `week_closed`,
`not_found`, `forbidden_op`, `invalid_payload`).

**Tipos de op (lista fechada, whitelist no servidor):**
`mission.complete`, `mission.uncomplete`, `payment.create`, `debt.create`,
`extra.add`, `extra.remove`, `setting.put` (só as keys `salary`, `pouch`, `pouch_goal`, `avatar`),
`visit.mark`, `attachment.create` (via multipart), `attachment.delete`.

---

## 6. Regras de conflito (fechadas)

| Op | Conflita quando | Resolução |
|---|---|---|
| `mission.complete` / `uncomplete` | a linha no PC foi tocada depois do `base.updatedAt` do celular **e** o status atual ≠ o desejado | **escolha do usuário**. Detectar por `updatedAt` (e não por comparar status) é o que pega o caso real "app concluiu offline, PC desfez de propósito" — nesse caso o status volta a ser igual ao que o celular tinha visto e uma comparação de status não veria nada. O preço é um falso positivo possível: se o cowork só corrigiu o texto da missão na mesma janela, aparece um card de conflito. Um toque a mais vale menos que um "desfiz" apagado sem aviso |
| `mission.*` em arco `closed` | sempre | `rejected: week_closed` — o app avisa e descarta (não é escolha) |
| `attachment.create` | nunca (append-only, dedupe por `clientUuid`) | automático |
| `payment.create` | nunca por si só; **mas** se existir pagamento no mesmo chefão, mesmo valor, dentro de 24 h → `possible_duplicate` | escolha: **manter os dois** ou **manter só um** |
| `debt.create` | já existe chefão ativo com nome igual (case-insensitive) → `possible_duplicate` | escolha: criar assim mesmo ou usar o existente |
| `extra.add` / `extra.remove` | nunca — cada freela tem `id` (uuid), a lista é união por id | automático |
| `setting.put` (`income_current`, `pouch`, `pouch_goal`, `avatar`) | valor no servidor mudou depois do `base.updatedAt` | **escolha do usuário** (mostra os dois valores) |
| `visit.mark` | nunca (união de datas) | automático |
| tema | não sincroniza (D12) | — |

**Resolver a favor do celular** = o app reenvia a op com `force:true` e `opId` derivado
(`<opId>#force`), o servidor aplica ignorando o `base`.
**Resolver a favor do PC** = o app apaga a op da outbox e o próximo pull traz a versão do PC.

> Migração necessária: os `extras` de hoje (Setting JSON) viram objetos com `id` uuid.
> Script `scripts/migrate-extras.ts`, roda uma vez.

---

## 7. Pareamento e alcance na rede

1. No painel (menu lateral → **"Parear celular"**): chama `GET /api/sync/info`, mostra o(s)
   IP(s) da máquina, um campo editável de IP e um **QR Code** com
   `{"host":"192.168.0.5","port":4000,"token":"a9f3…","name":"PC do Rodrigo"}`.
   Botões: **Gerar token novo** (invalida aparelhos) e **Copiar dados**.
2. O app abre a câmera, lê o QR, guarda `host/port/token` no **expo-secure-store**,
   chama `/api/sync/hello` e faz o primeiro `pull?since=0`.
3. Reconexão: a cada foreground o app faz `ping` com timeout de 2 s.
   Falhou → estado "offline" (o app continua funcionando).
4. **IP mudou (DHCP)**: botão **"Procurar PC na rede"** varre o `/24` da interface Wi-Fi
   atual na porta 4000 (timeout 300 ms, 16 em paralelo) e valida com o token. Recomendação
   no README: reservar IP fixo do PC no roteador.

### Gotchas reais (já mapeados)

- **Docker esconde o IP do host** — ✅ confirmado na prática em 26/07/2026: com o container
  no ar, `GET /api/sync/info` devolveu `lanIps: ["172.18.0.2"]`, inútil para o celular.
  Solução: `scripts/start.ps1` detecta o IPv4 da LAN no Windows e injeta `HOST_LAN_IP` no
  `docker compose up`; `lanIps()` já põe esse valor na frente da lista, e o painel deixa o
  campo editável.
- **Android bloqueia HTTP puro** desde o Android 9. Solução: `expo-build-properties` com
  `android.usesCleartextTraffic: true` (LAN privada, sem TLS — decisão consciente:
  o token protege o acesso, e o tráfego não sai da rede local).
- **Modo USB (bônus, sem custo):** com o cabo e `adb reverse tcp:4000 tcp:4000`, o app
  aponta para `127.0.0.1:4000` — o pareamento aceita esse host normalmente.

---

## 8. O app (`mobile/`)

### 8.1 Stack

| Item | Escolha |
|---|---|
| Runtime | Expo SDK (managed) + `expo-dev-client` |
| Navegação | `expo-router` — 5 abas |
| Estilo | NativeWind v4 + `tailwind.config.js` com os tokens do design |
| Banco | `expo-sqlite` (API assíncrona) |
| Segredos | `expo-secure-store` (token) |
| Arquivos | `expo-file-system`, `expo-image-picker`, `expo-document-picker`, `expo-image-manipulator` |
| QR | `expo-camera` (`CameraView` com `barcodeScannerSettings`) |
| Fontes | `@expo-google-fonts/rajdhani` + `@expo-google-fonts/ibm-plex-sans` |
| Estado | Zustand (leve) + hooks de repositório sobre o SQLite |
| Rede | `fetch` com `AbortController` (timeouts curtos) |

### 8.2 Tokens de cor (extraídos do protótipo)

```js
// claro                                  // escuro
accent:      '#f2a41c'                    accent:      '#f2a41c'
accentInk:   '#c47d0e'                    accentInk:   '#f2a41c'
bg:          ['#f6f4ef','#ece8e1','#e3ded5']  bg:      ['#1e1c1a','#171614','#100f0e']
ink/2/3:     '#2b2b2b','#7a746c','#8a847c'    ink/2/3: '#f0ece4','#b3aca1','#8f887d'
faint/2:     '#a49d95','#b8b1a8'              faint/2: '#7d766c','#615b52'
card:        '#ffffff'   cardLine: transparent    card: '#262320'  cardLine:'#37332d'
line:        '#e2ddd5'   soft: '#f8f6f1'          line: '#37332d'  soft:'#201e1b'
panel:       '#2b2b2b'   panelInk:'#ffffff'       panel:'#0e0d0c'  panelInk:'#f0ece4'
field:       '#ffffff'   track:'rgba(43,37,35,.1)' field:'#1b1917' track:'rgba(255,255,255,.1)'
navBg:       'rgba(255,255,255,.94)'          navBg:'rgba(20,19,17,.96)'
amberSoft:   '#fdf3e0'   danger:'#c0392b'      amberSoft:'rgba(242,164,28,.1)' danger:'#e74c3c'
```

### 8.3 Telas (1:1 com o protótipo)

| Aba | Conteúdo | Ações |
|---|---|---|
| **Missões** | herói compacto (avatar + anel de XP + nível + título + barra), card do andar com progresso, missões **principais lineares** (concluída / ativa / bloqueada), secundárias com XP bônus | CONCLUIR, anexar prova |
| **Status** | avatar grande com anel, título, XP, andar, poder total, **radar hexagonal** dos 6 atributos, card do ponto fraco | — |
| **Torre** | lista de andares em ordem decrescente, toque expande review + estrelas + nº de provas | — |
| **Chefões** | lista com barra de HP, detalhe com HP restante, input de valor e **ATACAR** (`-valor` flutuante), estado "☠ derrotado" | pagar, criar chefão |
| **Renda** | salário fixo, total do mês, barra de meta, editar salário/ganho, lista de freelas + adicionar | editar, adicionar freela |

Efeitos do protótipo a manter: `+XP` flutuante, toast, tela de celebração de nível
(raios girando + flash), animações `pop`/`slideIn`/`cascL`/`glowPulse`.

### 8.4 UI de sincronização (adição ao design)

As 5 abas ficam intactas. O sync entra em dois lugares:

1. **Chip no header**, ao lado do tema: ícone de nuvem com 4 estados —
   cinza (offline) · âmbar (PC alcançável, N pendentes) · girando (sincronizando) ·
   vermelho com badge (N conflitos).
2. **Bottom sheet "Sincronização"** ao tocar no chip:
   última sync, "N alterações na fila", **SINCRONIZAR AGORA**,
   **RESOLVER CONFLITOS (n)**, "Procurar PC na rede", "Parear novamente", nome do PC + IP.
3. **Tela de conflitos** (empilhada): cards com título do registro, coluna
   📱 Celular × 💻 PC, botões `Usar celular` / `Usar PC`, ações em massa no topo e
   `APLICAR N ESCOLHAS` no rodapé.

### 8.5 Banco local

Espelho: `character`, `titles`, `weeks`, `missions`, `attachments`, `debts`, `payments`,
`settings`, `visits` (mesmos ids do servidor).

Tabelas de sync:
```sql
sync_state(key TEXT PRIMARY KEY, value TEXT)          -- cursor, deviceId, lastSyncAt, host, port
outbox(opId TEXT PK, type TEXT, payload TEXT, base TEXT,
       createdAt TEXT, status TEXT, tries INT, lastError TEXT)   -- pending|sent|applied|conflict|discarded
conflicts(opId TEXT PK, entity TEXT, entityId TEXT, reason TEXT,
          mine TEXT, theirs TEXT, createdAt TEXT)
pending_files(opId TEXT PK, missionId INT, localUri TEXT, clientUuid TEXT, bytes INT)
```

Aplicação otimista: ao concluir uma missão offline, o app grava a op na outbox **e** aplica
XP/atributos localmente com as fórmulas espelhadas (`domain.ts`), para celebrar na hora.
No primeiro pull, os valores do servidor sobrescrevem os locais — sempre.

### 8.6 Motor de sync (`mobile/src/sync/`)

```
sync() {
  1. ping (2s)                        → sem rede: fim, estado "offline"
  2. push  (ops pending, em lote de 25, na ordem de criação)
       applied  → marca aplicada, remove da outbox
       conflict → grava em `conflicts`, mantém a op parada
       rejected → mostra motivo, descarta
  3. upload dos pending_files (um a um, com retry)
  4. pull (since = cursor) em páginas de 500 → aplica em transação
  5. atualiza lastSyncAt; se houver conflitos, badge vermelho
}
```
Retry com backoff exponencial (2s, 8s, 30s, 2min) e no máximo 5 tentativas por op antes de
parar e pedir ação. Uma op **nunca** é reenviada com opId diferente — é isso que garante
que ninguém ganha XP duas vezes.

---

## 9. Fases de execução

| Fase | Entrega | Arquivos principais |
|---|---|---|
| ~~**1. Backend — fundação**~~ ✅ | migration (`updatedAt`, `Tombstone`, `SyncOp`, `Device`, `clientUuid`), `AppError`, refatoração para `services/`, filtro do `sync_token` no `/api/settings` | `api/prisma/`, `api/src/lib/{errors,tombstones}.ts`, `api/src/services/*` |
| ~~**2. Backend — protocolo**~~ ✅ | `/api/sync/*` completo (info, pair, ping, hello, pull, push, attachments), whitelist de ops, detecção de conflito, idempotência via `SyncOp`, rate limit, reparo de datas (D19). **48 checagens automatizadas passando**, incluindo XP não duplicando em replay, conflito de missão/pagamento/setting, arco fechado e pull incremental | `api/src/routes/sync.ts`, `api/src/lib/sync/*`, `api/src/services/sync.service.ts` |
| **3. Painel + infra** | tela "Parear celular" com QR, `scripts/start.ps1` com `HOST_LAN_IP`, migração do avatar (localStorage → Setting) e dos `extras` (ids uuid) | `web/src/components/panels/PairPanel.tsx`, `scripts/` |
| **4. App — esqueleto** | projeto Expo, NativeWind + tokens, fontes, 5 abas, tema claro/escuro, componentes visuais do protótipo com dados mockados | `mobile/` |
| **5. App — banco local** | schema SQLite, repositórios, `domain.ts` espelhado, telas lendo do banco | `mobile/src/db/*` |
| **6. App — sync** | pareamento por QR, engine (push/pull/upload), chip de status, bottom sheet, retry/backoff | `mobile/src/sync/*` |
| **7. App — conflitos** | tela de resolução, `force`, ações em massa | `mobile/app/conflicts.tsx` |
| **8. App — provas** | câmera/galeria/arquivo, compressão, miniaturas, upload, limpeza pós-sync | `mobile/src/proofs/*` |
| **9. Build & distribuição** | ícone/splash ("Subir a Torre"), `eas.json` profile `preview`, `scripts/build-apk.ps1`, `/api/app/*`, QR de instalação no painel, aviso de nova versão no app (§13) | `mobile/eas.json`, `scripts/build-apk.ps1`, `api/src/routes/app.ts` |
| **10. Docs** | `docs/SYNC.md` (protocolo), README com seção do app, screenshots do APK | `docs/` |

Cada fase termina rodando `scripts/rebuild.ps1` (quando toca o backend) e com o app
funcionando ponta a ponta até onde a fase chegou.

---

## 10. Plano de testes (cenários obrigatórios antes de considerar pronto)

1. **XP não duplica**: concluir missão offline → forçar dois pushes com o mesmo `opId`
   (matar o app no meio do envio) → XP creditado exatamente uma vez.
2. **Conflito de missão**: concluir no celular (offline) e desfazer no painel → sync mostra
   1 conflito → "Usar celular" aplica; repetir escolhendo "Usar PC".
3. **Pagamento duplicado**: R$ 200 no chefão pelo app e R$ 200 no painel no mesmo dia →
   `possible_duplicate` → testar "manter os dois" e "manter só um".
4. **3 dias em modo avião**: 20+ ops acumuladas (missões, provas, pagamentos, freelas) →
   um único sync aplica tudo na ordem certa.
5. **Arco fechado no meio**: app com missão pendente, cowork fecha o arco no PC → op volta
   `rejected: week_closed` com aviso claro, sem quebrar a tela.
6. **Token errado / token regenerado**: 401 → app mostra "Pareamento expirado, leia o QR de novo".
7. **IP trocou**: mudar o IP do PC → "Procurar PC na rede" reencontra e reconecta.
8. **Prova de 20 MB**: upload conclui; 30 MB → erro tratado ("prova maior que o limite").
9. **Freelas simultâneos**: adicionar freela no app e outro no painel → os dois aparecem, sem conflito.
10. **Instalação limpa**: APK novo em aparelho zerado → parear → primeiro pull traz todo o histórico.

---

## 11. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| IP do PC muda (DHCP) | varredura sob demanda + instrução de IP fixo no roteador |
| Docker mascara o IP do host | `HOST_LAN_IP` via `scripts/start.ps1` + campo editável no painel |
| Android bloqueia HTTP puro | `usesCleartextTraffic` no build; tráfego só na LAN, protegido por token |
| Regras de XP divergirem entre app e API | `domain.ts` copiado com cabeçalho de aviso + teste que compara as constantes com a versão da API |
| Token vazando em `/api/settings` | filtro explícito + teste automatizado que falha se `sync_token` aparecer |
| EAS Build fora do ar / sem internet no dia | o APK anterior continua instalado; build local com SDK é o plano B (documentado, não executado) |
| Provas ocupando o celular | compressão + apagar original depois do upload confirmado |
| Servidor desligado quando o app tenta sincronizar | tudo continua offline; nada é perdido, a outbox só cresce |
| APK (~60 MB) inchando o git para sempre | binário mora em `data/apk/` (fora do git) e é servido pelo servidor; git guarda só o código |
| `COPY . .` do Dockerfile levando o `mobile/` inteiro para o build da imagem | adicionar `mobile` ao `.dockerignore` na Fase 4 |

---

## 12. Comandos previstos

```powershell
# backend (depois de mexer em api/)
scripts\rebuild.ps1

# subir o servidor já com o IP da LAN para o QR
scripts\start.ps1

# app — desenvolvimento
cd mobile; npm install; npx expo start --dev-client

# gerar o APK e publicá-lo no servidor local (§13)
scripts\build-apk.ps1            # eas build → data/apk/ → manifest.json
                                 # depois é só ler o QR "Instalar no celular" no painel
```

`mobile/eas.json` (profile `preview`): `"android": { "buildType": "apk" }`, distribuição
`internal` — sem loja, sem assinatura de produção.

---

## 13. Distribuição do APK — um repo, o servidor entrega o app

### Por que um repositório só

O `api/` e o `mobile/` compartilham um **contrato**: os tipos de operação, o formato do
pull, as regras de conflito, as fórmulas de XP. Em repos separados, esse contrato quebra em
silêncio — dá para subir um backend que o app instalado não entende mais, e só descobrir
com o celular na rua. No mesmo repo, um commit muda as duas pontas junto e a versão do
protocolo é a mesma por construção. Como bônus, o portfólio mostra full-stack + mobile +
sync offline numa peça só.

O preço é baixo e já está mapeado: `mobile/` fica fora do `workspaces` (Metro do Expo não
lida bem com hoisting) e entra no `.dockerignore` (senão o `COPY . .` do Dockerfile carrega
o app inteiro para dentro da imagem do servidor).

### O APK não vai para o git — vai para o `data/`

Commitar `.apk` (~60 MB) engorda o histórico **para sempre**, e o repositório é público.
Em vez disso o binário mora em `data/apk/`, ao lado do banco e das provas:

```
data/
├── upgrade.db
├── uploads/
└── apk/
    ├── upgrade-pessoal-1.2.0.apk
    └── manifest.json      { version, versionCode, builtAt, sizeBytes, sha256, file }
```

Isso encaixa em três coisas que já existem: `data/` é volume do Docker (**publicar uma
versão nova não exige rebuild da imagem** — o container enxerga o arquivo na hora),
`data/` já é a unidade de backup ("copiar a pasta `data/`") e já está fora do git.
Só falta trocar as linhas `data/*.db` / `data/uploads/` do `.gitignore` por `data/*` +
`!data/.gitkeep`, para nunca commitar um APK por distração.

### O fluxo, de ponta a ponta

```
1. você:  scripts\build-apk.ps1
             ├─ lê a versão de mobile/app.json (e sobe o versionCode)
             ├─ eas build -p android --profile preview --non-interactive --wait
             ├─ baixa o artefato para data/apk/upgrade-pessoal-<versão>.apk
             └─ escreve data/apk/manifest.json (com sha256)

2. servidor: GET /api/app/latest  →  manifesto
             GET /api/app/download →  o .apk

3. painel:  aba "Parear celular" ganha um segundo QR —
            "Instalar no celular"  →  http://192.168.0.5:4000/api/app/download
            (mostra versão publicada e data do build)

4. celular: aponta a câmera → baixa → instala.
            Da segunda vez em diante, o próprio app avisa:
            o ping do sync devolve `latestApp.versionCode`; se for maior que o
            instalado, aparece "Nova versão disponível · TOCAR PARA ATUALIZAR".
```

Nenhum cabo, nenhum e-mail para si mesmo, nenhum `adb install`. O mesmo servidor que
guarda o jogo entrega o app — e o pareamento e a instalação viram a mesma tela.

**Detalhes que fazem funcionar de verdade:**

- O download do artefato do EAS usa `eas build:download --platform android --latest`;
  se a versão do CLI não tiver o subcomando, o script cai para
  `eas build:list --json --limit 1` e baixa a `artifacts.applicationArchiveUrl`.
  O script valida o `sha256` antes de publicar o manifesto — APK pela metade não vai para o ar.
- O Android pede a permissão **"instalar apps de fontes desconhecidas"** para o navegador
  na primeira vez. Isso entra como passo no `docs/SETUP.md`, com print.
- `Content-Type: application/vnd.android.package-archive` no download, senão o Chrome
  trata como arquivo genérico e a instalação não é oferecida.
- Assinatura: o EAS gera e guarda um keystore por projeto. **Mantê-lo é obrigatório** —
  APK assinado com chave diferente não atualiza por cima, obriga desinstalar (e o
  desinstalar leva junto o SQLite local com as ops ainda não sincronizadas).
  `eas credentials` → baixar o keystore e guardar no backup, fora do git.
- O app checa a versão, mas **nunca instala sozinho**: abre o download e o Android conduz.
- `mobile/android/`, `mobile/ios/`, `mobile/.expo/` entram no `.gitignore` (saída de
  `expo prebuild`, regenerável).
