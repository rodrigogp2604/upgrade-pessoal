import type { Character } from "../../api";
import { FlameIcon } from "../icons";

export function StatusPanel({ c }: { c: Character }) {
  const stats = Object.entries(c.stats);
  const weakest = stats.length
    ? stats.reduce((min, cur) => (cur[1] < min[1] ? cur : min), stats[0])
    : null;

  return (
    <div className="panel" style={{ width: 330 }}>
      <div className="panel-head"><i /><b>STATUS DO JOGADOR</b></div>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 52, lineHeight: 1, color: "var(--amber)" }}>{c.level}</div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: "var(--mut2)", fontWeight: 600 }}>NÍVEL · TÍTULO</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{c.title ?? "Sem título — definido no briefing"}</div>
            {c.nextTitle && (
              <div style={{ fontSize: 11.5, color: "var(--mut2)" }}>
                Próximo: {c.nextTitle.name} no nível {c.nextTitle.level}
              </div>
            )}
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--mut2)", marginBottom: 4 }}>
            <span>XP {c.xpInto}/{c.xpNeeded}</span><span>NV. {c.level + 1}</span>
          </div>
          <div className="xpbar"><i style={{ width: `${c.xpPct}%` }} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="stat-box">
            <div className="stat-box-label">ANDAR DA TORRE</div>
            <div className="stat-box-value">{c.floor}</div>
          </div>
          <div className="stat-box">
            <div className="stat-box-label">PODER TOTAL</div>
            <div className="stat-box-value">{c.power} <small>/ 600</small></div>
          </div>
        </div>
        <div className="stat-box" style={{ fontSize: 12, color: "var(--mut)", display: "flex", gap: 9, alignItems: "center" }}>
          <FlameIcon />
          <span><b style={{ color: "var(--ink)" }}>{c.streak} {c.streak === 1 ? "dia" : "dias"}</b> de check-in consecutivo — o streak conta ao abrir o app.</span>
        </div>
        {weakest && (
          <div style={{ fontSize: 11.5, color: "var(--faint)", lineHeight: 1.45 }}>
            O andar da Torre é o seu nível: complete missões, ganhe XP e suba. Ponto fraco atual:{" "}
            <b style={{ color: "var(--amber-dk)" }}>{weakest[0]} ({Math.round(weakest[1])}/100)</b> — leve isso para a conversa de domingo.
          </div>
        )}
      </div>
    </div>
  );
}
