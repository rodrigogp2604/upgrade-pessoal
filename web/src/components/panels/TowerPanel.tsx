import type { OrphanReport, WeekSummary } from "../../api";
import { BrokenClipIcon, ClipIcon } from "../icons";

interface Props {
  weeks: WeekSummary[]; // como vem da API: mais recente primeiro
  selectedId: number | null;
  orphans: OrphanReport | null;
  busy: boolean;
  onSelect: (id: number) => void;
  onCleanupOrphans: () => void;
}

function starsText(w: WeekSummary): string {
  if (w.status === "active") return "ATUAL";
  const stars = w.rating ?? 0;
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}

export function TowerPanel({ weeks, selectedId, orphans, busy, onSelect, onCleanupOrphans }: Props) {
  const sel = weeks.find((w) => w.id === selectedId) ?? null;
  // Prova quebrada é assunto da Torre inteira, não do andar atual: a que motivou isto
  // estava num arco já fechado, onde nenhuma tela do painel olhava.
  const quebradas = orphans?.rows ?? [];
  const comBackup = quebradas.filter((o) => o.backupPath !== null).length;

  return (
    <div className="panel" style={{ width: 344 }}>
      <div className="panel-head"><i /><b>A TORRE · HISTÓRIA</b></div>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column-reverse", gap: 7 }}>
        {[...weeks].reverse().map((w) => {
          const atual = w.status === "active";
          const on = w.id === selectedId;
          return (
            <div
              key={w.id}
              className="floor-row"
              onClick={() => onSelect(w.id)}
              style={{
                background: atual ? (on ? "var(--amber)" : "rgba(242,164,28,.15)") : on ? "var(--ink)" : "var(--soft)",
                color: on ? "#fff" : "#5a544d",
                borderColor: atual && !on ? "rgba(242,164,28,.5)" : "transparent",
              }}
            >
              <div className="fn">{w.floor}</div>
              <div className="ft">
                <b>{w.theme}</b>
                <span>{atual ? "em andamento" : `${w.doneMissions}/${w.totalMissions} missões`}</span>
              </div>
              <div className="fs" style={atual && !on ? { color: "var(--amber-dk)" } : undefined}>{starsText(w)}</div>
            </div>
          );
        })}
        <div style={{ textAlign: "center", fontSize: 11, color: "var(--ghost)", padding: 4 }}>
          ⋯ a Torre continua acima, escondida na névoa ⋯
        </div>
        {weeks.length === 0 && (
          <div style={{ textAlign: "center", fontSize: 12, color: "var(--mut2)", padding: "10px 4px" }}>
            Nenhum andar registrado ainda — a história começa no primeiro arco.
          </div>
        )}
      </div>
      {sel && (
        <div className="panel-detail" key={sel.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <b style={{ fontSize: 13.5 }}>Andar {sel.floor} — {sel.theme}</b>
            <span style={{ color: "var(--amber)", letterSpacing: 2 }}>{starsText(sel)}</span>
          </div>
          {sel.review ? (
            <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 5, lineHeight: 1.5 }}>{sel.review}</div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 5, lineHeight: 1.5 }}>
              {sel.status === "active"
                ? "O andar atual. Fecha domingo, com avaliação por estrelas e espólio da semana."
                : "Arco fechado sem comentário de revisão."}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 7, display: "flex", gap: 6, alignItems: "center" }}>
            <ClipIcon size={12} />
            {sel.doneMissions}/{sel.totalMissions} missões concluídas neste andar
          </div>
          {sel.status === "active" && (
            <div style={{ marginTop: 11, background: "#fff", borderRadius: 3, padding: "9px 12px", fontSize: 11.5, color: "var(--mut)", lineHeight: 1.5 }}>
              O arco fecha na <b style={{ color: "var(--ink)" }}>revisão de domingo</b>: rode{" "}
              <b style={{ color: "var(--amber-dk)" }}>/fechar-arco</b> com seu cowork para receber as estrelas.
            </div>
          )}
        </div>
      )}

      {quebradas.length > 0 && (
        <div className="panel-detail" style={{ borderTop: "2px solid var(--red)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--red)", fontSize: 13 }}>
            <BrokenClipIcon size={14} />
            <b>
              {quebradas.length} {quebradas.length === 1 ? "PROVA QUEBRADA" : "PROVAS QUEBRADAS"}
            </b>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 5, lineHeight: 1.5 }}>
            O registro está no banco, o arquivo não está em <code>data/uploads</code>. No download
            dá 410 e a revisão de domingo lê como “sem prova”.
          </div>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
            {quebradas.map((o) => (
              <div key={o.id} style={{ fontSize: 11.5, background: "#fff", borderRadius: 3, padding: "7px 10px" }}>
                <b style={{ color: "var(--ink)" }}>{o.originalName}</b>
                <span style={{ color: "var(--faint)" }}> · anexo #{o.id}</span>
                <div style={{ color: "var(--mut2)" }}>{o.missionTitle}</div>
                {o.backupPath ? (
                  <div style={{ color: "var(--amber-dk)", marginTop: 2 }}>
                    recuperável: os bytes estão em <code>{o.backupPath}</code>
                  </div>
                ) : (
                  <div style={{ color: "var(--faint)", marginTop: 2 }}>sem cópia em backups/</div>
                )}
              </div>
            ))}
          </div>
          {comBackup > 0 && (
            <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 8, lineHeight: 1.5 }}>
              {comBackup === 1 ? "Uma delas ainda existe" : `${comBackup} delas ainda existem`} em
              backups/: copie o arquivo de volta para <code>data/uploads</code> e a prova volta
              inteira — limpar apaga o registro para sempre.
            </div>
          )}
          <button
            className="btn-proof"
            disabled={busy}
            style={{ marginTop: 10, borderColor: "var(--red)", color: "var(--red)" }}
            onClick={onCleanupOrphans}
          >
            <BrokenClipIcon size={12} />
            Esquecer {quebradas.length === 1 ? "este registro" : "estes registros"}
          </button>
        </div>
      )}

      {orphans && orphans.files.length > 0 && (
        <div className="panel-detail">
          <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.5 }}>
            <b style={{ color: "var(--ink)" }}>{orphans.files.length}</b>{" "}
            {orphans.files.length === 1 ? "arquivo em" : "arquivos em"} <code>data/uploads</code> que
            nenhuma prova reivindica. Podem ser sobras — ou provas de um banco restaurado pela
            metade. A limpeza não toca neles.
          </div>
        </div>
      )}
    </div>
  );
}
