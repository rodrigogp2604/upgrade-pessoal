import { levelFromXp, floorFromXp, titleFor, nextTitle, progressWithinLevel } from "../domain";

type CharacterRow = {
  id: number;
  name: string;
  xp: number;
  stats: string;
};

type TitleRow = { level: number; name: string };

export function characterView(c: CharacterRow, streak: number, ladder: TitleRow[]) {
  const stats = safeJson<Record<string, number>>(c.stats, {});
  const level = levelFromXp(c.xp);
  const { into, needed, pct } = progressWithinLevel(c.xp);
  return {
    id: c.id,
    name: c.name,
    xp: c.xp,
    level,
    floor: floorFromXp(c.xp),
    title: titleFor(level, ladder),
    nextTitle: nextTitle(level, ladder),
    xpInto: into,
    xpNeeded: needed,
    xpPct: pct,
    stats,
    power: Math.round(Object.values(stats).reduce((a, b) => a + b, 0)),
    streak,
  };
}

type AttachmentRow = {
  id: number;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
};

export function attachmentView(a: AttachmentRow) {
  return {
    id: a.id,
    originalName: a.originalName,
    mimeType: a.mimeType,
    size: a.size,
    createdAt: a.createdAt,
    url: `/api/attachments/${a.id}/download`,
  };
}

type MissionRow = {
  id: number;
  order: number;
  kind?: string;
  title: string;
  description: string | null;
  bonus: string | null;
  xp: number;
  statGains: string;
  status: string;
  rating: number | null;
  completedAt: Date | null;
  attachments?: AttachmentRow[];
};

export function missionView(m: MissionRow) {
  return {
    id: m.id,
    order: m.order,
    kind: m.kind === "side" ? "side" : "main",
    title: m.title,
    description: m.description,
    bonus: m.bonus,
    xp: m.xp,
    statGains: safeJson<Record<string, number>>(m.statGains, {}),
    status: m.status,
    rating: m.rating,
    completedAt: m.completedAt,
    attachments: (m.attachments ?? []).map(attachmentView),
  };
}

type DebtRow = {
  id: number;
  name: string;
  note: string | null;
  kind: string;
  total: number;
  status: string;
  order: number;
  payments?: { id: number; amount: number; note: string | null; date: Date }[];
};

export function debtView(d: DebtRow) {
  const payments = d.payments ?? [];
  const paid = payments.reduce((a, p) => a + p.amount, 0);
  const remaining = Math.max(0, d.total - paid);
  return {
    id: d.id,
    name: d.name,
    note: d.note,
    kind: d.kind,
    total: d.total,
    paid,
    remaining,
    hpPct: d.total > 0 ? Math.max(0, (remaining / d.total) * 100) : 0,
    status: remaining <= 0 ? "dead" : "active",
    order: d.order,
    payments: payments.map((p) => ({ id: p.id, amount: p.amount, note: p.note, date: p.date })),
  };
}

export function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
