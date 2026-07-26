import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { ACCENT } from "@/theme/palette";

// Rótulo de seção: "MISSÕES PRINCIPAIS · LINEARES"
export function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Text className={`font-displaySemi text-[12px] tracking-[2.4px] text-ink3 ${className}`}>{children}</Text>
  );
}

export function ProgressBar({
  pct,
  height = 6,
  track = "bg-track",
  fill = "bg-accent",
}: {
  pct: number;
  height?: number;
  track?: string;
  fill?: string;
}) {
  const largura = `${Math.max(0, Math.min(100, pct))}%` as const;
  return (
    <View className={`w-full overflow-hidden rounded-full ${track}`} style={{ height }}>
      <View className={`h-full rounded-full ${fill}`} style={{ width: largura }} />
    </View>
  );
}

// O protótipo desenha o anel de XP com conic-gradient; em React Native isso não existe,
// então o arco é um círculo SVG com o traço "cortado" por strokeDasharray.
export function XpRing({
  size,
  pct,
  thickness = 4,
  trackColor,
  children,
}: {
  size: number;
  pct: number;
  thickness?: number;
  trackColor: string;
  children?: React.ReactNode;
}) {
  const r = (size - thickness) / 2;
  const volta = 2 * Math.PI * r;
  const preenchido = (Math.max(0, Math.min(100, pct)) / 100) * volta;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={thickness} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={ACCENT}
          strokeWidth={thickness}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${preenchido} ${volta - preenchido}`}
          // -90°: começa no topo, como no protótipo
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View
        className="absolute items-center justify-center overflow-hidden rounded-full bg-card"
        style={{ top: thickness + 1, left: thickness + 1, right: thickness + 1, bottom: thickness + 1 }}
      >
        {children}
      </View>
    </View>
  );
}

// Sem foto ainda: iniciais no lugar (o avatar real chega pelo sync, Fase 6).
export function AvatarInitials({ name, size }: { name: string; size: number }) {
  const iniciais = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <View className="h-full w-full items-center justify-center bg-soft">
      <Text className="font-display text-ink2" style={{ fontSize: size * 0.34 }}>
        {iniciais}
      </Text>
    </View>
  );
}

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
