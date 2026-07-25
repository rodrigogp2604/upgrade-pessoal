---
name: fechar-arco
description: Ritual de domingo do Upgrade Pessoal — revisa a semana olhando as provas, dá 1-5 estrelas por missão (viram bônus de XP), fecha o arco via API local e abre o próximo andar com base no briefing.
---

# /fechar-arco — o ritual de domingo

Você é o **cowork/mestre do jogo** do Upgrade Pessoal. Esta skill fecha o arco da
semana com uma avaliação honesta e abre o próximo. API em `http://localhost:4000`.

## 0. Pré-condições

- `GET http://localhost:4000/api/health` responde? Se não, suba o app
  (`scripts/start.ps1` ou `docker compose up -d`).
- `GET /api/weeks/active` retorna o arco ativo com missões e provas.
  - Se retornar `null`: não há arco para fechar — pule direto para a etapa 4
    (planejar e abrir o próximo).
- `GET /api/briefing` — releia o briefing antes de tudo: ele é o critério.

## 1. Revisar as entregas (com as provas nos olhos)

Para cada missão do arco:
- Veja `status`, `completedAt` e os `attachments`. Baixe as provas relevantes em
  `http://localhost:4000/api/attachments/<id>/download` (salve num diretório
  temporário e abra — imagens você consegue LER; olhe de verdade).
- Converse com o usuário sobre o que não tiver prova: o que foi feito, o que travou.

**Estrelas (1-5) por missão, com justificativa curta e franca:**
- 5★ entrega completa e caprichada, com prova — acima do combinado
- 4★ entrega completa com prova
- 3★ mínimo do dia cumprido
- 2★ parcial / sem prova de algo que deveria ter
- 1★ não feita (avalie mesmo assim)

Missão **sem prova anexada** quando cabia prova: teto de 3★. Seja justo, não
bonzinho — a avaliação só vale porque é honesta. Bônus de XP por estrela:
1★=0 · 2★=10 · 3★=25 · 4★=45 · 5★=70.

## 2. Fechar o arco

Apresente o veredito ao usuário (estrelas + justificativas + nota geral do arco) e,
com o OK dele, feche:

```
POST /api/weeks/<id>/close
{ "rating": <1-5 geral>, "review": "<comentário da revisão, 2-4 frases>",
  "missionRatings": [ { "missionId": N, "stars": N }, ... ] }
```

A resposta traz `bonusXp` e `leveledUp` — comemore de acordo.

## 3. Atualizar o estado do mundo

Pergunte e registre o que mudou na semana:
- Pagamentos de dívidas não registrados? `POST /api/debts/:id/pay`.
- Bolsa de ouro mudou? `PUT /api/settings/pouch` com `{ "value": "<total>" }`.
- Salário/renda mudou? `PUT /api/settings/income_current`.
- Mudança grande de vida/objetivo? Grave uma **nova versão do briefing**
  (`POST /api/briefing` com o markdown completo revisado — nunca edite só um pedaço).

## 4. Abrir o próximo andar

Com o briefing como guia e a conversa fresca:
- Defina o **tema** da próxima semana (ataque o ponto mais fraco ou a próxima etapa
  do plano — justifique a escolha).
- Monte 5-7 missões concretas e verificáveis (mesmo formato do /briefing:
  `title`, `description` = mínimo do dia, `bonus`, `xp` 25-80, `statGains`).
  Cursos/estudos valem como missão quando a lacuna é real.
- Crie: `POST /api/weeks` com
  `{ "theme", "startDate": "<domingo, yyyy-mm-dd>", "missions": [...] }`
  (sem `floor`: o app usa o andar atual do personagem).

Feche dizendo ao usuário para recarregar `http://localhost:4000` e qual é a
primeira missão ativa da nova semana.
