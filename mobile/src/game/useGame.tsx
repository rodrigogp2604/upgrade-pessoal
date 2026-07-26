// Estado do jogo lido do SQLite local. Nenhuma tela sabe se o dado veio do PC ou de uma
// ação feita no ônibus: tudo passa pelo banco do aparelho.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSQLiteContext } from "expo-sqlite";
import type { GameData, Mission } from "./types";
import { levelFromXp, nextTitle, powerFromStats, progressWithinLevel, titleFor } from "@/domain";
import { countConflicts, countPending, loadGameData } from "@/db/repo";
import {
  addExtraLocal, completeMissionLocal, createDebtLocal, markVisitLocal,
  payDebtLocal, putSettingLocal, removeExtraLocal, uncompleteMissionLocal,
  type KeyDoApp,
} from "@/db/mutations";

type Feedback = { xp: number | null; toast: string | null; levelUp: number | null };

const VAZIO: GameData = {
  character: { name: "", xp: 0, stats: {} },
  titles: [], weeks: [], missions: [], attachments: [], debts: [], extras: [],
  settings: {}, streak: 0,
};

type GameContext = {
  carregando: boolean;
  /** true = aparelho ainda não recebeu nada do PC */
  vazio: boolean;
  data: GameData;
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
  pendentes: number;
  conflitos: number;
  recarregar: () => Promise<void>;
  completeMission: (id: number) => Promise<void>;
  uncompleteMission: (id: number) => Promise<void>;
  payDebt: (debtId: number, amount: number) => Promise<void>;
  createDebt: (e: { name: string; total: number; kind?: "debt" | "item"; note?: string }) => Promise<void>;
  addExtra: (name: string, value: number) => Promise<void>;
  removeExtra: (id: string) => Promise<void>;
  setSetting: (key: KeyDoApp, value: string) => Promise<void>;
  attachmentsOf: (missionId: number) => number;
  feedback: Feedback;
  clearFeedback: () => void;
};

const Ctx = createContext<GameContext | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [data, setData] = useState<GameData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [pendentes, setPendentes] = useState(0);
  const [conflitos, setConflitos] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>({ xp: null, toast: null, levelUp: null });

  const recarregar = useCallback(async () => {
    const [dados, p, c] = await Promise.all([loadGameData(db), countPending(db), countConflicts(db)]);
    setData(dados);
    setPendentes(p);
    setConflitos(c);
    setCarregando(false);
  }, [db]);

  useEffect(() => {
    // check-in do dia + primeira carga
    void (async () => {
      await recarregar();
      await markVisitLocal(db).catch(() => {}); // sem personagem ainda? a visita pode esperar
      await recarregar();
    })();
  }, [db, recarregar]);

  const dados = data ?? VAZIO;
  const level = levelFromXp(dados.character.xp);
  const { into, pct } = progressWithinLevel(dados.character.xp);
  const activeWeek = dados.weeks.find((w) => w.status === "active") ?? null;

  const missoesDoArco = useMemo(
    () => dados.missions.filter((m) => m.weekId === activeWeek?.id).sort((a, b) => a.order - b.order),
    [dados.missions, activeWeek?.id]
  );

  const completeMission = useCallback(
    async (id: number) => {
      const r = await completeMissionLocal(db, id);
      await recarregar();
      if (!r) return;
      const m = dados.missions.find((x) => x.id === id);
      setFeedback({
        xp: r.gainedXp,
        toast: r.leveledUp ? null : `+${r.gainedXp} XP · ${m?.title ?? "missão concluída"}`,
        levelUp: r.leveledUp ? r.newLevel : null,
      });
    },
    [db, recarregar, dados.missions]
  );

  const uncompleteMission = useCallback(
    async (id: number) => {
      const ok = await uncompleteMissionLocal(db, id);
      await recarregar();
      if (ok) setFeedback({ xp: null, toast: "Conclusão desfeita.", levelUp: null });
    },
    [db, recarregar]
  );

  const payDebt = useCallback(
    async (debtId: number, amount: number) => {
      const ok = await payDebtLocal(db, debtId, amount);
      await recarregar();
      if (ok) {
        setFeedback({
          xp: null,
          toast: `Ataque registrado: ${amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
          levelUp: null,
        });
      }
    },
    [db, recarregar]
  );

  const createDebt = useCallback(
    async (e: { name: string; total: number; kind?: "debt" | "item"; note?: string }) => {
      const ok = await createDebtLocal(db, e);
      await recarregar();
      if (ok) setFeedback({ xp: null, toast: `Chefão novo: ${e.name}`, levelUp: null });
    },
    [db, recarregar]
  );

  const addExtra = useCallback(
    async (name: string, value: number) => {
      const ok = await addExtraLocal(db, name, value);
      await recarregar();
      if (ok) setFeedback({ xp: null, toast: `Freela registrado: ${name}`, levelUp: null });
    },
    [db, recarregar]
  );

  const removeExtra = useCallback(
    async (id: string) => {
      await removeExtraLocal(db, id);
      await recarregar();
    },
    [db, recarregar]
  );

  const setSetting = useCallback(
    async (key: KeyDoApp, value: string) => {
      await putSettingLocal(db, key, value);
      await recarregar();
    },
    [db, recarregar]
  );

  const attachmentsOf = useCallback(
    (missionId: number) => dados.attachments.filter((a) => a.missionId === missionId).length,
    [dados.attachments]
  );

  const valor: GameContext = {
    carregando,
    vazio: data === null,
    data: dados,
    level,
    floor: activeWeek?.floor ?? level,
    title: titleFor(level, dados.titles),
    nextTitleLevel: nextTitle(level, dados.titles)?.level ?? null,
    power: powerFromStats(dados.character.stats),
    xpInto: into,
    xpPct: pct,
    activeWeek,
    mainMissions: missoesDoArco.filter((m) => m.kind !== "side"),
    sideMissions: missoesDoArco.filter((m) => m.kind === "side"),
    pendentes,
    conflitos,
    recarregar,
    completeMission,
    uncompleteMission,
    payDebt,
    createDebt,
    addExtra,
    removeExtra,
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
