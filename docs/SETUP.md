# Setup — instalar, rodar e desenvolver

Guia operacional do Upgrade Pessoal. O que o projeto **é** está no
[README](../README.md); aqui é como colocá-lo de pé.

## Requisitos

- **Docker Desktop** (ou Docker Engine + Compose no Linux)
- **Claude Code** ([claude.com/claude-code](https://claude.com/claude-code)) ou
  **Claude Cowork** — o mestre de jogo. Ambos leem as skills de `.claude/skills/`
  automaticamente ao abrir a pasta do projeto.
- Node 20+ apenas se for desenvolver (o Docker dispensa Node local)

## Instalação

```bash
git clone https://github.com/rodrigogpaulino/upgrade-pessoal.git
cd upgrade-pessoal
docker compose up -d
```

A primeira subida builda a imagem (alguns minutos). Depois disso o painel está em
**http://localhost:4000** — você verá a tela de boas-vindas pedindo o briefing.

### Windows: scripts prontos e atalho de desktop

| Comando | O que faz |
|---|---|
| `powershell -ExecutionPolicy Bypass -File scripts\start.ps1` | Liga o Docker (se preciso), sobe o painel e abre o navegador |
| `scripts\stop.ps1` | Para o painel (dados continuam salvos) |
| `scripts\rebuild.ps1` | Reconstrói a imagem após mudar o código |
| `scripts\backup.ps1` | Copia `data/` para `backups/data_<data>` |
| `scripts\install-shortcut.ps1` | Cria o atalho **"Subir a Torre"** na área de trabalho (ícone incluso) |

## Primeiro jogo

1. Painel no ar (`http://localhost:4000` mostrando o onboarding).
2. Abra o Claude **na pasta do projeto**:
   ```bash
   claude
   > /briefing
   ```
3. Responda a entrevista com sinceridade — ela define seu andar inicial (avaliativo),
   atributos, metas, chefões e as missões da primeira semana. Ao final, o painel se
   transforma sozinho na tela do jogo (ele verifica o banco a cada poucos segundos).

## O ciclo semanal

| Quando | Ação | Onde |
|---|---|---|
| Todo dia | Ver a missão ativa → fazer → CONCLUIR → anexar prova | Painel |
| Quando quiser | Atacar chefões (pagamentos), atualizar bolsa de ouro, registrar compras/freelas | Painel |
| Domingo | `claude` → `/fechar-arco` → estrelas, fechamento e novo arco | Claude |
| Vida mudou | Conversar com o Claude → nova versão do briefing | Claude |

Regras de progressão: **100 XP por nível** · nível = andar da Torre · estrelas do
fechamento: 2★ +10 · 3★ +25 · 4★ +45 · 5★ +70 XP · Saúde Financeira = 50% bolsa de
ouro vs meta + 50% dívidas pagas.

## O app no celular

O app Android é offline-first: funciona longe do PC e sincroniza quando volta para a
mesma rede. Ele faz o "campo" (concluir missão, anexar prova, atacar chefão, renda);
o arco da semana continua sendo fechado aqui, com o cowork.

**1. Gerar o APK** (precisa de conta gratuita no [Expo](https://expo.dev); o build roda
na nuvem porque esta máquina não precisa do Android SDK):

```powershell
scripts\build-apk.ps1
```

O script builda, baixa o artefato para `data/apk/` e publica no servidor local.

**2. Instalar** — no painel, ícone de celular → QR **"Instalar no celular"**. Aponte a
câmera, baixe e instale. Na primeira vez o Android pede para autorizar
*"instalar apps de fontes desconhecidas"* para o navegador — é uma vez só.

**3. Parear** — no mesmo painel, **"Parear celular"** gera o QR com endereço + token.
No app, toque em *Ler o QR do painel*. Pronto: ele baixa seu jogo e passa a sincronizar
sozinho ao abrir e a cada 5 minutos.

> Suba sempre pelo atalho **"Subir a Torre"** (ou `scripts\start.ps1`): é ele que
> descobre o IP da máquina na rede e o entrega ao servidor. Sem isso o QR sai com o IP
> interno do Docker, que o celular não alcança.

**Atualizar depois:** suba `version` e `versionCode` em `mobile/app.json`, rode
`scripts\build-apk.ps1` de novo. O app avisa sozinho na próxima sincronização.

⚠️ **Guarde o keystore.** O EAS cria uma chave de assinatura no primeiro build
(`npx eas-cli credentials` para baixar). APK assinado com chave diferente não atualiza
por cima: obriga desinstalar — e desinstalar leva junto o banco local do celular, com
as ações que ainda não subiram.

## Onde ficam os dados

Tudo em **`data/`** (fora do git):

- `data/upgrade.db` — SQLite com personagem, briefing, arcos, missões, chefões, configs
- `data/uploads/` — as provas anexadas
- `data/apk/` — o APK publicado + `manifest.json` (o que o celular baixa)

**Backup / trocar de máquina = copiar a pasta `data/`.** Nada fica no navegador
(exceto a foto do avatar, cosmética) e nada sai da sua máquina.

## Desenvolvimento

```bash
npm install          # workspaces: api + web
npm run dev          # API em :4000 (tsx watch) + Vite em :5173 com proxy de /api
npm run db:studio    # Prisma Studio para inspecionar o banco
```

Em produção (Docker) a API serve o build do front (`api/public`). Após mudar código:
`scripts\rebuild.ps1` (ou `docker compose up -d --build`).

### Mapa do repositório

```
api/          Express + Prisma (rotas em src/routes, regras do jogo em src/domain.ts)
api/docs/     Referência da API servida em /docs (HTML estático, sem build)
web/          React + Vite (painel de tela única; componentes em src/components)
mobile/       App Android (Expo + NativeWind + SQLite local) — ver docs/PLANO-MOBILE.md
.claude/
  skills/     /briefing e /fechar-arco — o "cérebro" do mestre de jogo
scripts/      PowerShell de conveniência (start, stop, rebuild, backup, atalho)
assets/       Ícone da Torre (svg + ico) — publicDir do Vite: vai para a raiz do site
              (favicon do painel e da /docs) e serve de ícone do atalho de desktop
data/         SEU jogo (git-ignored)
```

### API (resumo das rotas)

> **Referência completa e navegável: <http://localhost:4000/docs>** — com o servidor no ar.
> Todas as rotas, corpos de exemplo, respostas reais, catálogo de erros e um playground
> que executa as chamadas contra a sua própria instância. A página é estática
> (`api/docs/index.html`), servida pela API e sem build.

```
GET  /api/character          personagem + derivados (nível, andar, título, streak)
PUT  /api/character          calibragem ({ name, floor, stats }) — usada pelo /briefing
GET/POST /api/briefing       briefing ativo / nova versão (markdown, versionado)
GET/PUT  /api/titles         escada de títulos personalizada
GET  /api/weeks/active       arco ativo com missões e provas
POST /api/weeks              abre arco · POST /api/weeks/:id/close fecha (estrelas → XP)
POST /api/missions/:id/complete|uncomplete|attachments
GET/POST /api/debts          chefões (kind: debt|item) · POST /api/debts/:id/pay ataca
GET/PUT  /api/settings       chaves livres (pouch, pouch_goal, income_*, extras)

GET  /api/sync/info          IPs da máquina + aparelhos pareados (painel)
POST /api/sync/pair/new      gera token novo (invalida os aparelhos atuais)
GET/POST /api/sync/*         ping, hello, pull, push, attachments — exigem Bearer token
GET  /api/app/latest         versão do APK publicado · GET /api/app/download baixa
```

A API roda só em `localhost` e não tem autenticação — é um app single-player local.
Não a exponha à internet como está.

## Solução de problemas

- **Painel não abre** — `docker compose logs --tail 30`. Porta 4000 ocupada? Pare o
  outro processo ou mude o mapeamento no `docker-compose.yml`.
- **Skill não aparece no Claude** — confirme que abriu o Claude **na raiz do projeto**
  (as skills são relativas à pasta).
- **`/briefing` diz que o app não responde** — o painel precisa estar no ar antes
  (`scripts\start.ps1` ou `docker compose up -d`).
- **Recomeçar do zero** — pare o container, apague `data/upgrade.db` e suba de novo
  (as provas em `data/uploads/` você decide se mantém).
