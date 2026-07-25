import { useRef, useState } from "react";
import type { Mission, Week } from "../api";
import { CheckIcon, ClipIcon, LockIcon, ZapIcon } from "./icons";

interface Props {
  week: Week | null;
  busy: boolean;
  onComplete: (id: number) => void;
  onUpload: (id: number, files: FileList) => void;
}

function weekRangeLabel(startDate: string): string {
  const s = new Date(startDate + "T00:00:00");
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  const month = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long" });
  if (s.getMonth() === e.getMonth()) return `semana de ${s.getDate()} a ${e.getDate()} de ${month(e)}`;
  return `semana de ${s.getDate()} de ${month(s)} a ${e.getDate()} de ${month(e)}`;
}

function CoworkCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="newarc" style={{ marginTop: 9 }}>
      <div className="newarc-title">{title}</div>
      <div className="newarc-note">{children}</div>
    </div>
  );
}

export function MissionsColumn({ week, busy, onComplete, onUpload }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<number | null>(null);

  if (!week) {
    return (
      <div className="quests">
        <div className="floor-head">
          <div className="floor-head-row">
            <div className="floor-head-title">ENTRE ANDARES</div>
          </div>
          <div className="floor-head-sub">Nenhum arco ativo no momento.</div>
        </div>
        <div className="floor-body">
          <CoworkCard title="FALE COM SEU COWORK">
            O próximo andar é definido em conversa. Abra o Claude (Code ou Cowork) na pasta
            do projeto e rode <b style={{ color: "var(--ink)" }}>/fechar-arco</b> — ele revisa a semana,
            dá as estrelas e abre o próximo arco com você.
            <br /><br />
            Primeira vez aqui? Rode <b style={{ color: "var(--ink)" }}>/briefing</b>.
          </CoworkCard>
        </div>
      </div>
    );
  }

  const missions = [...week.missions].sort((a, b) => a.order - b.order);
  const activeId = missions.find((m) => m.status !== "done")?.id ?? null;
  const doneCount = missions.filter((m) => m.status === "done").length;
  const allDone = missions.length > 0 && activeId === null;
  const pct = missions.length ? (doneCount / missions.length) * 100 : 0;

  const pickProof = (id: number) => {
    setUploadTarget(id);
    fileRef.current?.click();
  };

  const renderMission = (m: Mission) => {
    if (m.status === "done") {
      return (
        <div className="m-done" key={m.id}>
          <div className="m-check"><CheckIcon /></div>
          <div className="m-done-title">{m.title}</div>
          {m.attachments.length > 0 && (
            <span style={{ color: "var(--pale)", display: "flex", alignItems: "center", gap: 3, fontSize: 11.5 }}>
              <ClipIcon size={11} />{m.attachments.length}
            </span>
          )}
          <div className="m-xp-done">+{m.xp} XP</div>
        </div>
      );
    }
    if (m.id === activeId) {
      return (
        <div className="m-active" key={m.id}>
          <div className="m-active-head">
            <span className="m-active-tag">MISSÃO ATIVA</span>
            <span className="m-active-xp">+{m.xp} XP</span>
          </div>
          <div className="m-active-title">{m.title}</div>
          {m.description && <div className="m-active-desc">{m.description}</div>}
          {m.bonus && (
            <div className="m-active-bonus"><ZapIcon />{m.bonus}</div>
          )}
          <div className="m-active-actions">
            <button className="btn-complete" disabled={busy} onClick={() => onComplete(m.id)}>
              <CheckIcon size={15} />CONCLUIR
            </button>
            <button className="btn-proof" disabled={busy} onClick={() => pickProof(m.id)}>
              <ClipIcon />{m.attachments.length > 0 ? `Provas (${m.attachments.length})` : "Anexar prova"}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="m-locked" key={m.id}>
        <div className="m-lock"><LockIcon /></div>
        <div className="m-locked-title">{m.title}</div>
        <div className="m-xp-locked">+{m.xp} XP</div>
      </div>
    );
  };

  return (
    <div className="quests">
      <div className="floor-head">
        <div className="floor-head-row">
          <div className="floor-head-title">ANDAR {week.floor}</div>
          <div className="floor-head-count">{doneCount}/{missions.length} MISSÕES</div>
        </div>
        <div className="floor-head-sub">{week.theme} — {weekRangeLabel(week.startDate)}</div>
        <div className="floor-bar"><i style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="floor-body">
        <div className="sec-label">MISSÕES PRINCIPAIS · LINEARES</div>
        {missions.map(renderMission)}
        {missions.length === 0 && (
          <CoworkCard title="ANDAR SEM MISSÕES">
            Este arco abriu vazio. Converse com o cowork para definir as quests da semana
            (ele adiciona pela API com base no seu briefing).
          </CoworkCard>
        )}
        {allDone && (
          <CoworkCard title="⚑ ANDAR LIMPO!">
            Todas as missões da semana foram concluídas. Para receber as estrelas
            (avaliadas sobre as notas e provas anexadas) e subir para o próximo andar,
            abra o Claude nesta pasta e rode <b style={{ color: "var(--ink)" }}>/fechar-arco</b>.
          </CoworkCard>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (uploadTarget != null && e.target.files && e.target.files.length > 0) {
            onUpload(uploadTarget, e.target.files);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
