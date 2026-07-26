// Ícones portados do protótipo (traço estilo Lucide) para react-native-svg.
// `color` explícito em vez de currentColor: em SVG nativo não existe herança de cor.
import Svg, { Circle, Path, Polygon, Polyline, Rect, Line } from "react-native-svg";
import { ACCENT } from "@/theme/palette";

type P = { size?: number; color?: string };

const traco = (color: string) => ({
  stroke: color,
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
});

export const FlameIcon = ({ size = 13 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
      fill={ACCENT}
      stroke={ACCENT}
      strokeWidth={1.5}
    />
  </Svg>
);

export const SunIcon = ({ size = 15, color = ACCENT }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={4} {...traco(color)} />
    <Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" {...traco(color)} />
  </Svg>
);

export const MoonIcon = ({ size = 15, color = "#8a847c" }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" {...traco(color)} />
  </Svg>
);

export const CheckIcon = ({ size = 12, color = "#fff" }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M20 6 9 17l-5-5" {...traco(color)} strokeWidth={3.2} />
  </Svg>
);

export const LockIcon = ({ size = 10, color = "#a49d95" }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x={3} y={11} width={18} height={11} rx={2} {...traco(color)} strokeWidth={2.4} />
    <Path d="M7 11V7a5 5 0 0 1 10 0v4" {...traco(color)} strokeWidth={2.4} />
  </Svg>
);

export const ZapIcon = ({ size = 13 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" fill={ACCENT} />
  </Svg>
);

export const ClipIcon = ({ size = 14, color = "#7a746c" }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"
      {...traco(color)}
    />
  </Svg>
);

export const StarIcon = ({ size = 12, color = ACCENT }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={color} />
  </Svg>
);

export const PlusIcon = ({ size = 11, color = ACCENT }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M5 12h14M12 5v14" {...traco(color)} strokeWidth={2.8} />
  </Svg>
);

export const SwordIcon = ({ size = 15, color = "#fff" }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" {...traco(color)} />
    <Line x1={13} y1={19} x2={19} y2={13} {...traco(color)} />
    <Line x1={16} y1={16} x2={20} y2={20} {...traco(color)} />
    <Line x1={19} y1={21} x2={21} y2={19} {...traco(color)} />
  </Svg>
);

// ── abas ──
export const MissionsTabIcon = ({ size = 21, color }: P & { color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M11 12H3M15 5l3 3-3 3M21 8H9M11 19H3M21 16H9" {...traco(color)} />
  </Svg>
);

export const StatusTabIcon = ({ size = 21, color }: P & { color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" {...traco(color)} />
    <Circle cx={12} cy={7} r={4} {...traco(color)} />
  </Svg>
);

export const TowerTabIcon = ({ size = 21, color }: P & { color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" {...traco(color)} />
    <Path d="M10 6h4M10 10h4M10 14h4" {...traco(color)} />
  </Svg>
);

export const BossTabIcon = ({ size = 21, color }: P & { color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20" {...traco(color)} />
    <Circle cx={9} cy={12} r={1} {...traco(color)} />
    <Circle cx={15} cy={12} r={1} {...traco(color)} />
    <Path d="M8 20v2h8v-2" {...traco(color)} />
  </Svg>
);

export const IncomeTabIcon = ({ size = 21, color }: P & { color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={8} cy={8} r={6} {...traco(color)} />
    <Path d="M18.09 10.37A6 6 0 1 1 10.34 18" {...traco(color)} />
    <Path d="M7 6h1v4" {...traco(color)} />
    <Path d="m16.71 13.88.7.71-2.82 2.82" {...traco(color)} />
  </Svg>
);

// nuvem do estado de sincronização (entra em ação na Fase 6)
export const CloudIcon = ({ size = 15, color = "#8a847c" }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 12 3.5 3.5 0 0 0 5 19Z" {...traco(color)} />
  </Svg>
);
