# Upgrade Pessoal — app mobile

App Android offline-first que conversa com o servidor local do projeto (`api/`).
O plano completo, com todas as decisões travadas, está em `../docs/PLANO-MOBILE.md` —
**leia antes de mexer aqui.**

Regras que não se negociam:

- O celular **não** cria arco, não fecha arco, não dá estrelas e não escreve briefing.
  Isso é do ritual de domingo com o cowork, no PC.
- Tudo funciona offline. Ação do usuário vira operação na fila (`outbox`) e só depois sobe.
- `src/domain.ts` é **cópia** de `api/src/domain.ts`. Se um mudar, o outro muda.
- Estilo via NativeWind: as cores vêm de variáveis CSS em `src/global.css` (tema escuro
  sobrescreve em `.dark:root`). Cores para SVG ficam em `src/theme/palette.ts` e precisam
  bater com o CSS.

Expo mudou bastante: consulte a doc da versão em https://docs.expo.dev/versions/v57.0.0/
antes de escrever código de plataforma.
