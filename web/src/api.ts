export interface Character {
  id: number; name: string; xp: number; level: number; floor: number;
  title: string | null; nextTitle: { level: number; name: string } | null;
  xpInto: number; xpNeeded: number; xpPct: number;
  stats: Record<string, number>; power: number; streak: number;
}
export interface Briefing { id: number; content: string; createdAt: string; versions: number; }
export interface Attachment {
  id: number; originalName: string; mimeType: string; size: number; createdAt: string; url: string;
  /** registrada no banco mas sem arquivo em data/uploads: o download responde 410 */
  missing: boolean;
}
export interface OrphanRow {
  id: number; missionId: number; missionTitle: string; originalName: string;
  filename: string; createdAt: string; backupPath: string | null;
}
export interface OrphanReport { rows: OrphanRow[]; files: string[]; }
export interface Mission {
  id: number; order: number; title: string; description: string | null; bonus: string | null;
  xp: number; statGains: Record<string, number>; status: string; rating: number | null;
  completedAt: string | null; attachments: Attachment[];
}
export interface Week {
  id: number; floor: number; theme: string; startDate: string; status: string;
  rating: number | null; review: string | null; closedAt: string | null; missions: Mission[];
}
export interface Debt {
  id: number; name: string; note: string | null; kind: "debt" | "item";
  total: number; paid: number; remaining: number;
  hpPct: number; status: string; order: number;
  payments: { id: number; amount: number; note: string | null; date: string }[];
}
export interface DebtsResponse { debts: Debt[]; totals: { total: number; paid: number; remaining: number }; }
export interface WeekSummary {
  id: number; floor: number; theme: string; startDate: string; status: string;
  rating: number | null; review: string | null; closedAt: string | null;
  totalMissions: number; doneMissions: number;
}
export interface CompleteResult {
  mission: Mission; character: Character; leveledUp: boolean; newLevel: number;
  gainedXp: number; gains: Record<string, number>;
}

export interface SyncDevice {
  id: string; name: string; lastSeen: string; lastPulledAt: string | null;
}
export interface SyncInfo {
  lanIps: string[]; port: number; tokenSet: boolean;
  hostLanIpFromEnv: string | null; devices: SyncDevice[];
}
export interface Pairing { token: string; hosts: string[]; port: number; protocol: number; }
export interface ApkPublicado {
  publicado: boolean; version?: string; versionCode?: number; builtAt?: string;
  sizeBytes?: number; comoPublicar?: string;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getCharacter: () => req<Character>("/api/character"),
  getBriefing: () => req<Briefing | null>("/api/briefing"),
  getActiveWeek: () => req<Week | null>("/api/weeks/active"),
  getWeeks: () => req<WeekSummary[]>("/api/weeks"),
  getDebts: () => req<DebtsResponse>("/api/debts"),
  getSettings: () => req<Record<string, string>>("/api/settings"),
  putSetting: (key: string, value: string) =>
    req<Record<string, string>>(`/api/settings/${key}`, { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify({ value }) }),

  completeMission: (id: number) => req<CompleteResult>(`/api/missions/${id}/complete`, { method: "POST" }),
  uncompleteMission: (id: number) => req<any>(`/api/missions/${id}/uncomplete`, { method: "POST" }),
  addMission: (data: { title: string; xp?: number; description?: string; statGains?: Record<string, number> }) =>
    req<Mission>("/api/missions", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(data) }),

  payDebt: (id: number, amount: number, note?: string) =>
    req<{ debt: Debt; defeated: boolean }>(`/api/debts/${id}/pay`, {
      method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ amount, note }),
    }),
  addDebt: (data: { name: string; total: number; note?: string; kind?: "debt" | "item" }) =>
    req<Debt>("/api/debts", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(data) }),

  uploadProof: async (missionId: number, files: FileList) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    return req<Attachment[]>(`/api/missions/${missionId}/attachments`, { method: "POST", body: fd });
  },
  deleteProof: (id: number) => req<void>(`/api/attachments/${id}`, { method: "DELETE" }),

  getOrphans: () => req<OrphanReport>("/api/attachments/orphans"),
  cleanupOrphans: () =>
    req<{ removed: OrphanRow[]; files: string[] }>("/api/attachments/orphans/cleanup", { method: "POST" }),

  closeWeek: (id: number, data: { rating: number; review?: string; missionRatings: { missionId: number; stars: number }[] }) =>
    req<any>(`/api/weeks/${id}/close`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(data) }),
  createWeek: (data: { theme: string; startDate: string; floor?: number; missions: any[] }) =>
    req<Week>("/api/weeks", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(data) }),

  getSyncInfo: () => req<SyncInfo>("/api/sync/info"),
  newPairing: () => req<Pairing>("/api/sync/pair/new", { method: "POST" }),
  getApk: () => req<ApkPublicado>("/api/app/latest"),
};

export function brl(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
