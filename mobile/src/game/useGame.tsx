// Estado do jogo + valores derivados. Hoje serve o mock; na Fase 5 a fonte passa a ser
// o SQLite local e as ações passam a enfileirar operações na outbox — as telas não mudam.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { MOCK } from "./mock";
import type { GameData, Mission } from "./types";
import { levelFromXp, powerFromStats, progressWithinLevel, titleFor, nextTitle } from "@/domain";

type Feedback = { xp: number | null; toast: string | null; levelUp: number | null };

type GameContext = {
  data: GameData;
  // derivados
  level: number;
  floor: number;
  title: string | null;
  nextTitleLevel: number | null;
  power: number;
  xpInto: number;
  xpPct: number;
  activeWeek: GameData["weeks"][number] | null;
  mainMissions: Mission[];
  sideMissions: Mission[];
  // ações
  completeMission: (id: number) => void;
  payDebt: (debtId: number, amount: number) => void;
  addExtra: (name: string, value: number) => void;
  setSetting: (key: string, value: string) => void;
  attachmentsOf: (missionId: number) => number;
  feedback: Feedback;
  clearFeedback: () => void;
};

const Ctx = createContext<GameContext | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GameData>(MOCK);
  const [feedback, setFeedback] = useState<Feedback>({ xp: null, toast: null, levelUp: null });

  const level = levelFromXp(data.character.xp);
  const { into, pct } = progressWithinLevel(data.character.xp);
  const activeWeek = data.weeks.find((w) => w.status === "active") ?? null;

  const missionsDoArco = useMemo(
    () => data.missions.filter((m) => m.weekId === activeWeek?.id).sort((a, b) => a.order - b.order),
    [data.missions, activeWeek?.id]
  );

  const completeMission = useCallback((id: number) => {
    setData((atual) => {
      const m = atual.missions.find((x) => x.id === id);
      if (!m || m.status === "done") return atual;

      // mesmas fórmulas da API (src/domain.ts): o app celebra na hora, offline
      const stats = { ...atual.character.stats };
      for (const [k, v] of Object.entries(m.statGains)) stats[k] = Math.min(100, (stats[k] ?? 0) + v);
      const xp = atual.character.xp + m.xp;

      const subiu = levelFromXp(xp) > levelFromXp(atual.character.xp);
      setFeedback({
        xp: m.xp,
        toast: subiu ? null : `+${m.xp} XP · ${m.title}`,
        levelUp: subiu ? levelFromXp(xp) : null,
      });

      return {
        ...atual,
        character: { ...atual.character, xp, stats },
        missions: atual.missions.map((x) => (x.id === id ? { ...x, status: "done" as const } : x)),
      };
    });
  }, []);

  const payDebt = useCallback((debtId: number, amount: number) => {
    setData((atual) => ({
      ...atual,
      debts: atual.debts.map((d) => {
        if (d.id !== debtId) return d;
        const paid = Math.min(d.total, d.paid + amount);
        return { ...d, paid, status: paid >= d.total ? ("dead" as const) : d.status };
      }),
    }));
    setFeedback({ xp: null, toast: `Ataque registrado: ${amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, levelUp: null });
  }, []);

  const addExtra = useCallback((name: string, value: number) => {
    setData((atual) => ({
      ...atual,
      extras: [...atual.extras, { id: `${Date.now()}`, name, value }],
    }));
    setFeedback({ xp: null, toast: `Freela registrado: ${name}`, levelUp: null });
  }, []);

  const setSetting = useCallback((key: string, value: string) => {
    setData((atual) => ({ ...atual, settings: { ...atual.settings, [key]: value } }));
  }, []);

  const attachmentsOf = useCallback(
    (missionId: number) => data.attachments.filter((a) => a.missionId === missionId).length,
    [data.attachments]
  );

  const valor: GameContext = {
    data,
    level,
    floor: activeWeek?.floor ?? level,
    title: titleFor(level, data.titles),
    nextTitleLevel: nextTitle(level, data.titles)?.level ?? null,
    power: powerFromStats(data.character.stats),
    xpInto: into,
    xpPct: pct,
    activeWeek,
    // "principais lineares" x "secundárias com XP bônus", como no protótipo
    mainMissions: missionsDoArco.filter((m) => m.kind !== "side"),
    sideMissions: missionsDoArco.filter((m) => m.kind === "side"),
    completeMission,
    payDebt,
    addExtra,
    setSetting,
    attachmentsOf,
    feedback,
    clearFeedback: () => setFeedback({ xp: null, toast: null, levelUp: null }),
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useGame(): GameContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGame precisa estar dentro de <GameProvider>");
  return ctx;
}
