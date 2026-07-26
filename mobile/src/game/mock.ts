// Dados de exemplo para desenhar as telas antes do banco local existir (Fase 5).
// Personagem fictícia de propósito — nada pessoal entra no repositório.
import type { GameData } from "./types";

export const MOCK: GameData = {
  character: {
    name: "MARINA",
    xp: 1370,
    stats: {
      "Domínio Técnico": 62,
      Renda: 24,
      "Saúde Financeira": 18,
      Networking: 15,
      "Marca Pessoal": 8,
      "Presença Digital": 26,
    },
  },
  titles: [
    { id: 1, level: 1, name: "Artífice Sem Nome" },
    { id: 2, level: 10, name: "Portador de Marca" },
    { id: 3, level: 18, name: "Voz da Guilda" },
    { id: 4, level: 25, name: "Arquiteto da Prosperidade" },
  ],
  weeks: [
    { id: 2, floor: 14, theme: "Sair da Invisibilidade", startDate: "2026-07-26", status: "active", rating: null, review: null },
    { id: 1, floor: 13, theme: "Existir no Digital", startDate: "2026-07-19", status: "closed", rating: 4, review: "Entregou o essencial e provou com link público. O post ficou raso — na próxima, mostre número." },
  ],
  missions: [
    { id: 8, weekId: 2, order: 1, title: "Fazer o perfil do GitHub existir", description: "Foto, bio e README de perfil.", bonus: "Fixe 3 repositórios.", xp: 30, statGains: { "Presença Digital": 8 }, status: "done", rating: null },
    { id: 9, weekId: 2, order: 2, title: "LinkedIn: headline + skills", description: "Headline que diz o que você resolve, não o cargo.", bonus: "Peça uma recomendação.", xp: 40, statGains: { "Marca Pessoal": 6 }, status: "done", rating: null },
    { id: 10, weekId: 2, order: 3, title: "Mapa de caça: 15 empresas remoto BR", description: "Planilha com vaga, stack e o nome de quem contrata.", bonus: "Marque as 3 mais alinhadas.", xp: 45, statGains: { Networking: 7 }, status: "pending", rating: null },
    { id: 11, weekId: 2, order: 4, title: "Currículo reescrito por resultado", description: "Cada linha vira 'fiz X e aconteceu Y'.", bonus: "Peça leitura de alguém de fora.", xp: 50, statGains: { "Marca Pessoal": 8 }, status: "pending", rating: null },
    { id: 12, weekId: 2, order: 5, title: "Vitrine do repositório", description: "README com print, o problema e como rodar.", bonus: "Grave um gif de 20s.", xp: 40, statGains: { "Presença Digital": 7 }, status: "pending", rating: null },
    { id: 13, weekId: 2, order: 6, title: "Seu primeiro post no LinkedIn", description: "Conte o que aprendeu construindo isso.", bonus: "Responda todo comentário.", xp: 70, statGains: { "Marca Pessoal": 10 }, status: "pending", rating: null, kind: "side" },
    { id: 14, weekId: 2, order: 7, title: "Uma VPS no ar (a lacuna)", description: "Suba o projeto num servidor de verdade.", bonus: "Domínio próprio + HTTPS.", xp: 80, statGains: { "Domínio Técnico": 9 }, status: "pending", rating: null, kind: "side" },
  ],
  attachments: [
    { id: 1, missionId: 8, originalName: "github-perfil.png", url: "/api/attachments/1/download" },
    { id: 2, missionId: 9, originalName: "headline.png", url: "/api/attachments/2/download" },
  ],
  debts: [
    { id: 1, name: "Cartão Nubank", note: "rolando desde março", kind: "debt", total: 3200, paid: 1150, status: "active" },
    { id: 2, name: "Notebook novo", note: "12x", kind: "item", total: 4200, paid: 3500, status: "active" },
  ],
  extras: [{ id: "a1", name: "Site do dentista", value: 800 }],
  settings: {
    income_start: "3600",
    income_checkpoint: "5000",
    income_target: "7000",
    income_current: "3600",
    pouch: "1500",
    pouch_goal: "6000",
  },
  streak: 12,
};
