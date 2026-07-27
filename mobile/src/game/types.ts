// Formas espelhando o payload de GET /api/sync/pull. A Fase 5 troca a fonte (SQLite)
// sem tocar nas telas.
export type Character = { name: string; xp: number; stats: Record<string, number> };
export type Title = { id: number; level: number; name: string };

export type Attachment = { id: number; missionId: number; originalName: string; url: string };

export type Mission = {
  id: number;
  weekId: number;
  order: number;
  title: string;
  description: string | null;
  bonus: string | null;
  xp: number;
  statGains: Record<string, number>;
  status: "pending" | "done";
  rating: number | null;
  kind?: "main" | "side"; // secundárias = XP bônus (o servidor não distingue; ordem manda)
};

export type Week = {
  id: number;
  floor: number;
  theme: string;
  startDate: string;
  status: "active" | "closed";
  rating: number | null;
  review: string | null;
};

export type Debt = {
  id: number;
  name: string;
  note: string | null;
  kind: "debt" | "item";
  total: number;
  paid: number;
  status: "active" | "dead";
};

export type Extra = { id: string; name: string; value: number };

export type GameData = {
  character: Character;
  titles: Title[];
  weeks: Week[];
  missions: Mission[];
  attachments: Attachment[];
  debts: Debt[];
  extras: Extra[];
  settings: Record<string, string>;
  streak: number;
};
