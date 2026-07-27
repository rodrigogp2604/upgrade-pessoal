import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type Briefing, type Character, type DebtsResponse, type Week, type WeekSummary } from "./api";
import { TopBar } from "./components/TopBar";
import { MissionsColumn } from "./components/MissionsColumn";
import { CharacterCenter } from "./components/CharacterCenter";
import { SideMenu } from "./components/SideMenu";
import { Onboarding } from "./components/Onboarding";
import { StatusPanel } from "./components/panels/StatusPanel";
import { TowerPanel } from "./components/panels/TowerPanel";
import { BossPanel } from "./components/panels/BossPanel";
import { IncomePanel, type Extra } from "./components/panels/IncomePanel";
import { BagPanel } from "./components/panels/BagPanel";
import { BriefingPanel } from "./components/panels/BriefingPanel";
import { PairPanel } from "./components/panels/PairPanel";
import { Celebration, type CelebrationData } from "./components/Celebration";

export type MenuId = "status" | "torre" | "boss" | "renda" | "bolsa" | "briefing" | "celular" | null;

// Chave do tempo em que o avatar morava só neste navegador. Hoje ele é uma Setting no
// banco (para o celular também ver); isto aqui sobrevive apenas para a migração.
const AVATAR_KEY_LEGADO = "upgrade-pessoal-avatar";

function money(v: number): string {
  return "R$ " + Math.round(v).toLocaleString("pt-BR");
}

export default function App() {
  const [character, setCharacter] = useState<Character | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [week, setWeek] = useState<Week | null>(null);
  const [weeks, setWeeks] = useState<WeekSummary[]>([]);
  const [debts, setDebts] = useState<DebtsResponse | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [menu, setMenu] = useState<MenuId>(null);
  const [bossSel, setBossSel] = useState<number | null>(null);
  const [floorSel, setFloorSel] = useState<number | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [xpFloat, setXpFloat] = useState<number | null>(null);
  const [bossHit, setBossHit] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);

  const timers = useRef<{ toast?: number; xp?: number; hit?: number }>({});

  const avatar = settings.avatar ?? null;

  const extras: Extra[] = useMemo(() => {
    try {
      const raw = JSON.parse(settings.extras ?? "[]");
      return Array.isArray(raw) ? raw.filter((e) => e && typeof e.name === "string" && typeof e.value === "number") : [];
    } catch {
      return [];
    }
  }, [settings.extras]);

  const flash = useCallback((msg: string) => {
    window.clearTimeout(timers.current.toast);
    setToast(msg);
    timers.current.toast = window.setTimeout(() => setToast(null), 2800);
  }, []);

  async function loadAll() {
    const [c, b, w, ws, d, s] = await Promise.all([
      api.getCharacter(), api.getBriefing(), api.getActiveWeek(), api.getWeeks(), api.getDebts(), api.getSettings(),
    ]);
    setCharacter(c); setBriefing(b); setWeek(w); setWeeks(ws); setDebts(d);

    // Migração de uma vez: avatar que estava só neste navegador sobe para o banco.
    const legado = localStorage.getItem(AVATAR_KEY_LEGADO);
    if (!s.avatar && legado) {
      try {
        await api.putSetting("avatar", legado);
        s.avatar = legado;
        localStorage.removeItem(AVATAR_KEY_LEGADO);
      } catch {
        // sem drama: fica no navegador e tentamos na próxima carga
      }
    }

    setSettings(s);
    setLoading(false);
  }

  useEffect(() => {
    loadAll().catch((e) => { console.error(e); setLoading(false); });
  }, []);

  // Onboarding e "andar limpo": o cowork mexe no banco por fora,
  // então o painel se atualiza sozinho de tempos em tempos.
  const needsPoll = !briefing || !week || (week.missions.length > 0 && week.missions.every((m) => m.status === "done"));
  useEffect(() => {
    if (loading || !needsPoll) return;
    const t = window.setInterval(() => { loadAll().catch(() => {}); }, 5000);
    return () => window.clearInterval(t);
  }, [loading, needsPoll]);

  async function withBusy<T>(fn: () => Promise<T>) {
    setBusy(true);
    try { return await fn(); }
    catch (e) { flash("Algo deu errado: " + (e as Error).message); }
    finally { setBusy(false); }
  }

  const floatXp = (amount: number) => {
    window.clearTimeout(timers.current.xp);
    setXpFloat(amount);
    timers.current.xp = window.setTimeout(() => setXpFloat(null), 1500);
  };

  const handleComplete = (id: number) =>
    withBusy(async () => {
      const r = await api.completeMission(id);
      setCharacter(r.character);
      setWeek(await api.getActiveWeek());
      setWeeks(await api.getWeeks());
      floatXp(r.gainedXp);
      const gains = Object.entries(r.gains).map(([k, v]) => `${k} +${v}`).join(" · ");
      if (gains) flash("Missão concluída! " + gains);
      if (r.leveledUp) {
        window.setTimeout(() => setCelebration({ type: "level", level: r.newLevel, title: r.character.title }), 650);
      }
    });

  const handleUpload = (id: number, files: FileList) =>
    withBusy(async () => {
      await api.uploadProof(id, files);
      setWeek(await api.getActiveWeek());
      flash("Prova anexada — vale na avaliação de domingo");
    });

  const handleAttack = (id: number, amount: number) =>
    withBusy(async () => {
      const r = await api.payDebt(id, amount);
      const [d, c] = await Promise.all([api.getDebts(), api.getCharacter()]);
      setDebts(d); setCharacter(c);
      window.clearTimeout(timers.current.hit);
      setBossHit(amount);
      timers.current.hit = window.setTimeout(() => setBossHit(null), 1300);
      if (r.defeated) {
        window.setTimeout(() => setCelebration({ type: "boss", name: r.debt.name, isItem: r.debt.kind === "item" }), 900);
      } else {
        const fin = Math.round(c.stats["Saúde Financeira"] ?? 0);
        flash(`Dano causado! Saúde Financeira agora em ${fin}/100`);
      }
    });

  const handleAddPurchase = (name: string, total: number, alreadyPaid: number) =>
    withBusy(async () => {
      const debt = await api.addDebt({ name, total, kind: "item" });
      if (alreadyPaid > 0) await api.payDebt(debt.id, alreadyPaid);
      const [d, c] = await Promise.all([api.getDebts(), api.getCharacter()]);
      setDebts(d); setCharacter(c);
      if (alreadyPaid >= total) {
        setCelebration({ type: "boss", name, isItem: true });
      } else {
        flash(`${name} registrado — chefão com ${money(total - alreadyPaid)} de HP`);
        setBossSel(debt.id);
      }
    });

  const handleSaveSalary = (value: number) =>
    withBusy(async () => {
      await api.putSetting("income_current", String(value));
      setSettings(await api.getSettings());
      flash("Salário atualizado: " + money(value));
    });

  const handleSavePouch = (value: number) =>
    withBusy(async () => {
      await api.putSetting("pouch", String(value));
      const [s, c] = await Promise.all([api.getSettings(), api.getCharacter()]);
      setSettings(s); setCharacter(c);
      flash("Bolsa de ouro atualizada: " + money(value));
    });

  const handleAddExtra = (name: string, value: number) =>
    withBusy(async () => {
      // cada freela nasce com id: é o que deixa celular e painel adicionarem no mesmo
      // dia sem gerar conflito (a fusão é por id, não pela lista inteira)
      const next = [...extras, { id: crypto.randomUUID(), name, value, at: new Date().toISOString() }];
      await api.putSetting("extras", JSON.stringify(next));
      setSettings(await api.getSettings());
      flash("Quest secundária registrada: +" + money(value) + " no mês");
    });

  const handlePickAvatar = (dataUrl: string) =>
    withBusy(async () => {
      await api.putSetting("avatar", dataUrl);
      setSettings(await api.getSettings());
      flash("Foto atualizada — o celular recebe na próxima sincronização.");
    });

  const toggleMenu = (m: Exclude<MenuId, null>) => {
    setMenu((cur) => {
      const next = cur === m ? null : m;
      if (next === "boss" && debts) {
        setBossSel((s) => s ?? debts.debts.find((d) => d.status === "active")?.id ?? null);
      }
      if (next === "torre") {
        setFloorSel((s) => s ?? week?.id ?? weeks[0]?.id ?? null);
      }
      return next;
    });
  };

  if (loading) return <div className="loading">CARREGANDO A TORRE…</div>;
  if (!briefing) return <Onboarding />;
  if (!character) return <div className="loading">SEM PERSONAGEM — ALGO ESTRANHO NO BANCO.</div>;

  const floor = week?.floor ?? character.floor;

  return (
    <div className="app">
      <div className="watermark">ANDAR {floor}</div>
      <div className="topline" />

      <TopBar floor={floor} theme={week?.theme ?? null} streak={character.streak} />

      <div className="main">
        <MissionsColumn
          week={week}
          busy={busy}
          onComplete={handleComplete}
          onUpload={handleUpload}
        />
        <CharacterCenter c={character} avatarUrl={avatar} onPickAvatar={handlePickAvatar} />
        <SideMenu active={menu} onToggle={toggleMenu} />
      </div>

      {menu && (
        <>
          <div className="backdrop" onClick={() => setMenu(null)} />
          <div className="cascade" key={menu}>
            <div className="cascade-scroll">
              {menu === "status" && <StatusPanel c={character} />}
              {menu === "torre" && (
                <TowerPanel weeks={weeks} selectedId={floorSel} onSelect={setFloorSel} />
              )}
              {menu === "boss" && debts && (
                <BossPanel
                  data={debts}
                  busy={busy}
                  selectedId={bossSel}
                  bossHit={bossHit}
                  finHealth={Math.round(character.stats["Saúde Financeira"] ?? 0)}
                  onSelect={setBossSel}
                  onAttack={handleAttack}
                />
              )}
              {menu === "renda" && (
                <IncomePanel
                  settings={settings}
                  extras={extras}
                  busy={busy}
                  onSaveSalary={handleSaveSalary}
                  onSavePouch={handleSavePouch}
                  onAddExtra={handleAddExtra}
                />
              )}
              {menu === "bolsa" && debts && (
                <BagPanel data={debts} busy={busy} onAddPurchase={handleAddPurchase} />
              )}
              {menu === "briefing" && <BriefingPanel briefing={briefing} />}
              {menu === "celular" && <PairPanel />}
            </div>
            <div className="cascade-arrow" />
          </div>
        </>
      )}

      {xpFloat != null && <div className="xp-float">+{xpFloat} XP</div>}

      {toast && <div className="toast"><i />{toast}</div>}

      {celebration && <Celebration data={celebration} onClose={() => setCelebration(null)} />}
    </div>
  );
}
