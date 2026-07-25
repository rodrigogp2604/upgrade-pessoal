import { useRef } from "react";

export interface Extra { name: string; value: number; }

interface Props {
  settings: Record<string, string>;
  extras: Extra[];
  busy: boolean;
  onSaveSalary: (value: number) => void;
  onSavePouch: (value: number) => void;
  onAddExtra: (name: string, value: number) => void;
}

function money(v: number): string {
  return "R$ " + Math.round(v).toLocaleString("pt-BR");
}

export function IncomePanel({ settings, extras, busy, onSaveSalary, onSavePouch, onAddExtra }: Props) {
  const salaryRef = useRef<HTMLInputElement>(null);
  const pouchRef = useRef<HTMLInputElement>(null);
  const freelaNameRef = useRef<HTMLInputElement>(null);
  const freelaValRef = useRef<HTMLInputElement>(null);

  const start = Number(settings.income_start ?? 0);
  const checkpoint = Number(settings.income_checkpoint ?? 0);
  const target = Number(settings.income_target ?? 0);
  const salary = Number(settings.income_current ?? start);
  const pouch = Number(settings.pouch ?? 0);
  const pouchGoal = Number(settings.pouch_goal ?? 0);
  const monthTotal = salary + extras.reduce((a, e) => a + e.value, 0);
  const hasGoals = target > start && start > 0;
  const goalPct = hasGoals ? Math.max(2, Math.min(100, Math.round(((monthTotal - start) / (target - start)) * 100))) : 0;
  const checkpointPct = hasGoals ? Math.round(((checkpoint - start) / (target - start)) * 100) : 50;
  const pouchPct = pouchGoal > 0 ? Math.min(100, Math.round((pouch / pouchGoal) * 100)) : 0;

  const save = (ref: React.RefObject<HTMLInputElement>, fn: (v: number) => void) => {
    const v = parseFloat(ref.current?.value ?? "");
    if (isNaN(v) || v < 0) return;
    if (ref.current) ref.current.value = "";
    fn(v);
  };

  const addFreela = () => {
    const n = freelaNameRef.current?.value.trim() ?? "";
    const v = parseFloat(freelaValRef.current?.value ?? "");
    if (!n || !v || v <= 0) return;
    if (freelaNameRef.current) freelaNameRef.current.value = "";
    if (freelaValRef.current) freelaValRef.current.value = "";
    onAddExtra(n, v);
  };

  return (
    <div className="panel" style={{ width: 360 }}>
      <div className="panel-head"><i /><b>RENDA · BOLSA DE OURO</b></div>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="stat-box" style={{ flex: 1 }}>
            <div className="stat-box-label">SALÁRIO · INFORMATIVO</div>
            <div className="stat-box-value" style={{ fontSize: 20 }}>{money(salary)}</div>
          </div>
          <div style={{ flex: 1, background: "#fdf3e0", borderRadius: 4, padding: "10px 12px", border: "1px solid rgba(242,164,28,.4)" }}>
            <div className="stat-box-label" style={{ color: "var(--amber-dk)" }}>MÊS COM FREELAS</div>
            <div className="stat-box-value" style={{ fontSize: 20, color: "var(--amber-dk)" }}>{money(monthTotal)}</div>
          </div>
        </div>

        {hasGoals && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--mut2)", marginBottom: 4, fontWeight: 600 }}>
              <span>MISSÃO PRINCIPAL DE RENDA</span>
              <span>{money(start)} → {money(checkpoint)} → {money(target)}+</span>
            </div>
            <div style={{ height: 9, background: "#efece6", borderRadius: 5, position: "relative", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${goalPct}%`, background: "linear-gradient(90deg,#f2a41c,#f7c14f)", borderRadius: 5, transition: "width .6s" }} />
              <div style={{ position: "absolute", left: `${checkpointPct}%`, top: 0, bottom: 0, width: 2, background: "#fff" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>
              Checkpoint {money(checkpoint)} · chefe final {money(target)}+ · metas do briefing
            </div>
          </div>
        )}

        <div style={{ borderTop: "1px solid #eee9e1", paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--mut2)", marginBottom: 4, fontWeight: 600 }}>
            <span style={{ letterSpacing: 1.5 }}>BOLSA DE OURO · GUARDADO</span>
            {pouchGoal > 0 && <span>meta {money(pouchGoal)}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 26, color: "var(--amber-dk)" }}>{money(pouch)}</div>
            {pouchGoal > 0 && <div style={{ fontSize: 11.5, color: "var(--mut2)" }}>{pouchPct}% da meta</div>}
          </div>
          {pouchGoal > 0 && (
            <div className="xpbar" style={{ marginTop: 6 }}><i style={{ width: `${pouchPct}%` }} /></div>
          )}
          <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
            <input ref={pouchRef} type="number" placeholder="Novo total guardado (R$)" className="field" style={{ flex: 1 }}
              onKeyDown={(e) => { if (e.key === "Enter") save(pouchRef, onSavePouch); }} />
            <button className="btn-dark" disabled={busy} onClick={() => save(pouchRef, onSavePouch)}>ATUALIZAR</button>
          </div>
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 5, lineHeight: 1.45 }}>
            Atualize quando quiser — não é extrato bancário. Bolsa cheia (vs meta do briefing) sobe sua{" "}
            <b style={{ color: "var(--amber-dk)" }}>Saúde Financeira</b>.
          </div>
        </div>

        <div style={{ borderTop: "1px solid #eee9e1", paddingTop: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: "var(--mut2)", fontWeight: 600, marginBottom: 7 }}>ATUALIZAR SALÁRIO (INFORMATIVO)</div>
          <div style={{ display: "flex", gap: 7 }}>
            <input ref={salaryRef} type="number" placeholder="Novo salário (R$)" className="field" style={{ flex: 1 }}
              onKeyDown={(e) => { if (e.key === "Enter") save(salaryRef, onSaveSalary); }} />
            <button className="btn-dark" disabled={busy} onClick={() => save(salaryRef, onSaveSalary)}>OK</button>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #eee9e1", paddingTop: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: "var(--mut2)", fontWeight: 600, marginBottom: 7 }}>
            QUESTS SECUNDÁRIAS DE RENDA · FREELAS
          </div>
          {extras.map((e, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--soft)", borderRadius: 3, padding: "7px 11px", marginBottom: 6, fontSize: 12.5, animation: "cascL .3s ease-out" }}>
              <span>{e.name}</span>
              <b style={{ color: "var(--amber-dk)", fontFamily: "var(--disp)", fontSize: 14 }}>+{money(e.value)}</b>
            </div>
          ))}
          <div style={{ display: "flex", gap: 7 }}>
            <input ref={freelaNameRef} placeholder="Freela / bico (ex.: site do dentista)" className="field" style={{ flex: 2 }} />
            <input ref={freelaValRef} type="number" placeholder="R$" className="field" style={{ flex: 1 }}
              onKeyDown={(e) => { if (e.key === "Enter") addFreela(); }} />
            <button className="btn-outline-amber" disabled={busy} style={{ fontSize: 16, padding: "6px 13px" }} onClick={addFreela}>+</button>
          </div>
        </div>
      </div>
    </div>
  );
}
