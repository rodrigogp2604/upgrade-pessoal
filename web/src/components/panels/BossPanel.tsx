import { useRef } from "react";
import type { DebtsResponse } from "../../api";
import { BossIcon, SwordIcon } from "../icons";

interface Props {
  data: DebtsResponse;
  busy: boolean;
  selectedId: number | null;
  bossHit: number | null;
  finHealth: number;
  onSelect: (id: number) => void;
  onAttack: (id: number, amount: number) => void;
}

function money(v: number): string {
  return "R$ " + Math.round(v).toLocaleString("pt-BR");
}

export function BossPanel({ data, busy, selectedId, bossHit, finHealth, onSelect, onAttack }: Props) {
  const payRef = useRef<HTMLInputElement>(null);
  // aquisições quitadas viram itens e moram na bolsa, não aqui
  const bosses = data.debts.filter((d) => !(d.kind === "item" && d.status === "dead"));
  const sel = bosses.find((d) => d.id === selectedId) ?? null;

  const attack = () => {
    if (!sel) return;
    const v = parseFloat((payRef.current?.value ?? "").replace(",", "."));
    if (!v || v <= 0) return;
    if (payRef.current) payRef.current.value = "";
    onAttack(sel.id, v);
  };

  return (
    <div className="panel" style={{ width: 360 }}>
      <div className="panel-head">
        <i /><b>CHEFÕES</b>
        {data.totals.remaining > 0 && <small>restam {money(data.totals.remaining)}</small>}
      </div>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
        {bosses.length === 0 && (
          <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--mut2)", padding: "14px 8px", lineHeight: 1.5 }}>
            Nenhum chefão à vista — sem dívidas nem compras pendentes.<br />
            Cadastre uma pelo cowork ou registre uma compra parcelada aqui quando surgir.
          </div>
        )}
        {bosses.map((d) => {
          const on = d.id === selectedId;
          const hp = Math.round(d.hpPct);
          return (
            <div
              key={d.id}
              className="boss-row"
              onClick={() => onSelect(d.id)}
              style={{
                background: on ? "var(--ink)" : "var(--soft)",
                color: on ? "#fff" : "#5a544d",
                boxShadow: on ? "0 6px 16px rgba(43,37,35,.3)" : "none",
                opacity: d.status === "dead" ? 0.5 : 1,
              }}
            >
              <span style={{ flex: "none", display: "flex" }}><BossIcon size={17} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  {d.name}
                  <span style={{
                    fontSize: 9, letterSpacing: 1, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
                    background: on ? "rgba(255,255,255,.18)" : "rgba(43,37,35,.08)",
                    color: d.kind === "item" ? "var(--amber)" : (on ? "#e8b7b0" : "var(--red)"),
                  }}>
                    {d.kind === "item" ? "COMPRA" : "DÍVIDA"}
                  </span>
                </div>
                <div className="boss-hpbar"><i style={{ width: `${hp}%` }} /></div>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                <div style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 14 }}>{hp}%</div>
                <div style={{ fontSize: 10.5, opacity: 0.65 }}>HP</div>
              </div>
            </div>
          );
        })}
      </div>
      {sel && (
        <div className="panel-detail" key={sel.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <b style={{ fontSize: 14 }}>{sel.name}</b>
            {sel.note && <span style={{ fontSize: 11.5, color: "var(--mut2)" }}>{sel.note}</span>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--mut2)", margin: "9px 0 4px" }}>
            <span>HP restante</span>
            <b style={{ color: "var(--red)", fontSize: 13 }}>{money(sel.remaining)}</b>
          </div>
          <div className="boss-bigbar" style={{ animation: bossHit ? "shake .45s ease-out" : "none" }}>
            <i style={{ width: `${Math.round(sel.hpPct)}%` }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 3 }}>
            de {money(sel.total)} · {money(sel.paid)} de dano causado
            {sel.kind === "item" && " · quitou, vira item na bolsa"}
          </div>
          {sel.status === "dead" ? (
            <div className="boss-dead">☠ CHEFÃO DERROTADO</div>
          ) : (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                ref={payRef}
                type="number"
                placeholder="Valor do pagamento (R$)"
                className="field"
                style={{ flex: 1, padding: "9px 11px" }}
                onKeyDown={(e) => { if (e.key === "Enter") attack(); }}
              />
              <button className="btn-attack" disabled={busy} onClick={attack}>
                <SwordIcon />ATACAR
              </button>
            </div>
          )}
          {bossHit != null && <div className="boss-hit">-{money(bossHit)}</div>}
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 9 }}>
            Cada ataque sobe sua <b style={{ color: "var(--amber-dk)" }}>Saúde Financeira</b> — hoje em {finHealth}/100.
          </div>
        </div>
      )}
    </div>
  );
}
