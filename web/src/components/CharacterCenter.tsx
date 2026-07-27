import { useRef } from "react";
import type { Character } from "../api";
import { StarIcon } from "./icons";
import { downscaleToDataUrl } from "../lib/image";

// Ordem e posição dos atributos no hexágono (sentido horário a partir do topo).
const RADAR_ORDER = [
  "Domínio Técnico",
  "Renda",
  "Saúde Financeira",
  "Networking",
  "Marca Pessoal",
  "Presença Digital",
] as const;

const VERTICES = [
  [100, 17], [167.6, 56], [167.6, 134], [100, 173], [32.4, 134], [32.4, 56],
] as const;

const LABELS: { x: number; y: number; anchor: "start" | "middle" | "end" }[] = [
  { x: 100, y: 6, anchor: "middle" },
  { x: 174, y: 52, anchor: "start" },
  { x: 174, y: 142, anchor: "start" },
  { x: 100, y: 186, anchor: "middle" },
  { x: 26, y: 142, anchor: "end" },
  { x: 26, y: 52, anchor: "end" },
];

function Radar({ stats }: { stats: Record<string, number> }) {
  const values = RADAR_ORDER.map((k) => Math.round(stats[k] ?? 0));
  const weakest = values.indexOf(Math.min(...values));
  const hexPts = values
    .map((val, i) => {
      const a = ((-90 + i * 60) * Math.PI) / 180;
      const r = (78 * Math.max(val, 3)) / 100;
      return `${(100 + r * Math.cos(a)).toFixed(1)},${(95 + r * Math.sin(a)).toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width="330" height="228" viewBox="0 0 200 190" style={{ fontFamily: "'IBM Plex Sans',sans-serif", overflow: "visible" }}>
      <polygon points="100,17 167.6,56 167.6,134 100,173 32.4,134 32.4,56" fill="rgba(255,255,255,.5)" stroke="#cfc9c0" strokeWidth="1.4" />
      <polygon points="100,56 133.8,75.5 133.8,114.5 100,134 66.2,114.5 66.2,75.5" fill="none" stroke="#ddd8cf" strokeWidth="1" />
      <polygon points={hexPts} fill="rgba(242,164,28,.28)" stroke="#f2a41c" strokeWidth="2.2" strokeLinejoin="round" style={{ transition: "all .7s cubic-bezier(.2,1,.3,1)" }} />
      <line x1="100" y1="17" x2="100" y2="173" stroke="#e8e3da" strokeWidth="1" />
      <line x1="32.4" y1="56" x2="167.6" y2="134" stroke="#e8e3da" strokeWidth="1" />
      <line x1="167.6" y1="56" x2="32.4" y2="134" stroke="#e8e3da" strokeWidth="1" />
      {VERTICES.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === weakest ? 5.5 : 4.5} fill={i === weakest ? "#f2a41c" : "#2b2b2b"} />
      ))}
      {RADAR_ORDER.map((name, i) => (
        <text
          key={name}
          x={LABELS[i].x}
          y={LABELS[i].y}
          fontSize="9"
          fontWeight={i === weakest ? 700 : 600}
          fill={i === weakest ? "#c47d0e" : "#5a544d"}
          textAnchor={LABELS[i].anchor}
        >
          {name} · {values[i]}
        </text>
      ))}
    </svg>
  );
}

interface Props {
  c: Character;
  avatarUrl: string | null;
  onPickAvatar: (dataUrl: string) => void;
}

export function CharacterCenter({ c, avatarUrl, onPickAvatar }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const xpDeg = c.xpPct * 3.6;

  return (
    <div className="center">
      <div className="avatar-wrap">
        <div className="avatar-halo" />
        <div className="avatar-ring" style={{ background: `conic-gradient(#f2a41c 0 ${xpDeg}deg, #e2ddd5 ${xpDeg}deg 360deg)` }} />
        <button className="avatar-photo" title="Trocar foto" onClick={() => fileRef.current?.click()}>
          {avatarUrl
            ? <img src={avatarUrl} alt={c.name} />
            : <span className="avatar-placeholder">Sua foto<br />(a do GitHub!)</span>}
        </button>
        <div className="lvl-badge">NV. {c.level}</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            // reduz antes de subir: a foto agora vive no banco e viaja no sync do celular
            if (f) void downscaleToDataUrl(f).then(onPickAvatar);
            e.target.value = "";
          }}
        />
      </div>
      <div style={{ textAlign: "center" }}>
        <div className="char-name">{c.name}</div>
        <div className="char-title"><StarIcon />{c.title}</div>
        <div className="char-xpline">
          XP {c.xpInto}/{c.xpNeeded} para o nível {c.level + 1} · Poder total <b>{c.power}</b>
        </div>
      </div>
      <Radar stats={c.stats} />
    </div>
  );
}
