// Cores em JS para o que NÃO é estilizável por classe: `fill`/`stroke` de SVG
// (ícones e o radar hexagonal) e gradientes.
//
// ⚠️ Precisa bater com as variáveis de src/global.css. Mudou lá, muda aqui.
export const ACCENT = "#f2a41c";
export const ACCENT_SOFT = "#f7c14f";

export type Palette = {
  accent: string;
  accentInk: string;
  ink: string;
  ink2: string;
  ink3: string;
  faint: string;
  faint2: string;
  card: string;
  line: string;
  soft: string;
  track: string;
  panel: string;
  panelInk: string;
  hexFill: string;
  hexGrid: string;
  dot: string;
  danger: string;
  /** três faixas do degradê de fundo, do topo para a base */
  bg: readonly [string, string, string];
};

const claro: Palette = {
  accent: ACCENT,
  accentInk: "#c47d0e",
  ink: "#2b2b2b",
  ink2: "#7a746c",
  ink3: "#8a847c",
  faint: "#a49d95",
  faint2: "#b8b1a8",
  card: "#ffffff",
  line: "#e2ddd5",
  soft: "#f8f6f1",
  track: "#efece6",
  panel: "#2b2b2b",
  panelInk: "#ffffff",
  hexFill: "#f8f6f1",
  hexGrid: "#ece8e1",
  dot: "#2b2b2b",
  danger: "#c0392b",
  bg: ["#f6f4ef", "#ece8e1", "#e3ded5"] as const,
};

const escuro: Palette = {
  accent: ACCENT,
  accentInk: "#f2a41c",
  ink: "#f0ece4",
  ink2: "#b3aca1",
  ink3: "#8f887d",
  faint: "#7d766c",
  faint2: "#615b52",
  card: "#262320",
  line: "#37332d",
  soft: "#201e1b",
  track: "#332f2a",
  panel: "#0e0d0c",
  panelInk: "#f0ece4",
  hexFill: "#211f1c",
  hexGrid: "#332f2a",
  dot: "#f0ece4",
  danger: "#e74c3c",
  bg: ["#1e1c1a", "#171614", "#100f0e"],
};

export const PALETTES: Record<"light" | "dark", Palette> = { light: claro, dark: escuro };
