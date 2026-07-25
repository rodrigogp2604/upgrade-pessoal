import type { Briefing } from "../../api";

// O briefing é escrito pelo cowork na conversa — aqui é só leitura.
export function BriefingPanel({ briefing }: { briefing: Briefing | null }) {
  return (
    <div className="panel" style={{ width: 420 }}>
      <div className="panel-head">
        <i /><b>BRIEFING</b>
        {briefing && (
          <small>
            v{briefing.versions} · {new Date(briefing.createdAt).toLocaleDateString("pt-BR")}
          </small>
        )}
      </div>
      {briefing ? (
        <div style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 12.5, lineHeight: 1.65, color: "#4a453f", whiteSpace: "pre-wrap", maxHeight: "56vh", overflowY: "auto" }}>
            {briefing.content}
          </div>
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 10, borderTop: "1px solid #eee9e1", paddingTop: 9, lineHeight: 1.5 }}>
            Este documento guia todas as missões. Para revisar, converse com o cowork —
            ele grava uma nova versão aqui.
          </div>
        </div>
      ) : (
        <div style={{ padding: "18px", textAlign: "center", fontSize: 12.5, color: "var(--mut2)", lineHeight: 1.6 }}>
          Ainda não há briefing. Abra o Claude nesta pasta e rode{" "}
          <b style={{ color: "var(--amber-dk)" }}>/briefing</b> para a entrevista inicial.
        </div>
      )}
    </div>
  );
}
