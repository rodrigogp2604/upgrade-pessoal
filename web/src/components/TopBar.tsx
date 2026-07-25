import { FlameIcon } from "./icons";

interface Props {
  floor: number;
  theme: string | null;
  streak: number;
}

export function TopBar({ floor, theme, streak }: Props) {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark"><span /></div>
        <div className="brand-name">UPGRADE PESSOAL</div>
      </div>
      <div className="topbar-floor">
        <i />
        ANDAR {floor}{theme ? ` · ${theme}` : ""}
        <i />
      </div>
      <div className="streak-pill">
        <FlameIcon />
        <b>{streak}</b>
        <span>{streak === 1 ? "dia de streak" : "dias de streak"}</span>
      </div>
    </div>
  );
}
