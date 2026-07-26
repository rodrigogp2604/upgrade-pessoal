import { View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import { ACCENT } from "@/theme/palette";
import { useAppTheme } from "@/theme/useAppTheme";

// Hexágono dos 6 atributos, na mesma ordem e posição do protótipo (horário do topo).
const ORDEM = ["Domínio Técnico", "Renda", "Saúde Financeira", "Networking", "Marca Pessoal", "Presença Digital"] as const;

const VERTICES = [
  [100, 17], [167.6, 56], [167.6, 134], [100, 173], [32.4, 134], [32.4, 56],
] as const;

const ROTULOS: { x: number; y: number; anchor: "start" | "middle" | "end" }[] = [
  { x: 100, y: 6, anchor: "middle" },
  { x: 173, y: 50, anchor: "start" },
  { x: 173, y: 144, anchor: "start" },
  { x: 100, y: 188, anchor: "middle" },
  { x: 27, y: 144, anchor: "end" },
  { x: 27, y: 50, anchor: "end" },
];

export function Radar({ stats }: { stats: Record<string, number> }) {
  const { palette } = useAppTheme();
  const valores = ORDEM.map((k) => Math.round(stats[k] ?? 0));
  const maisFraco = valores.indexOf(Math.min(...valores));

  // raio proporcional ao valor; mínimo 3 para o polígono não colapsar num ponto
  const pontos = valores
    .map((v, i) => {
      const a = ((-90 + i * 60) * Math.PI) / 180;
      const r = (78 * Math.max(v, 3)) / 100;
      return `${(100 + r * Math.cos(a)).toFixed(1)},${(95 + r * Math.sin(a)).toFixed(1)}`;
    })
    .join(" ");

  return (
    <View className="rounded-md border border-cardLine bg-card px-1 pb-1 pt-1.5">
      <Svg width="100%" height={210} viewBox="-14 -8 228 206">
        <Polygon points="100,17 167.6,56 167.6,134 100,173 32.4,134 32.4,56" fill={palette.hexFill} stroke={palette.line} strokeWidth={1.4} />
        <Polygon points="100,56 133.8,75.5 133.8,114.5 100,134 66.2,114.5 66.2,75.5" fill="none" stroke={palette.hexGrid} strokeWidth={1} />
        <Polygon points={pontos} fill="rgba(242,164,28,0.28)" stroke={ACCENT} strokeWidth={2.2} strokeLinejoin="round" />
        <Line x1={100} y1={17} x2={100} y2={173} stroke={palette.hexGrid} strokeWidth={1} />
        <Line x1={32.4} y1={56} x2={167.6} y2={134} stroke={palette.hexGrid} strokeWidth={1} />
        <Line x1={167.6} y1={56} x2={32.4} y2={134} stroke={palette.hexGrid} strokeWidth={1} />
        {VERTICES.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={i === maisFraco ? 5.5 : 4} fill={i === maisFraco ? ACCENT : palette.dot} />
        ))}
        {ORDEM.map((nome, i) => (
          <SvgText
            key={nome}
            x={ROTULOS[i].x}
            y={ROTULOS[i].y}
            fontSize={9.5}
            fontWeight={i === maisFraco ? "700" : "600"}
            fill={i === maisFraco ? ACCENT : palette.ink2}
            textAnchor={ROTULOS[i].anchor}
          >
            {`${nome} · ${valores[i]}`}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

export function pontoFraco(stats: Record<string, number>): { nome: string; valor: number } {
  const pares = ORDEM.map((k) => ({ nome: k as string, valor: Math.round(stats[k] ?? 0) }));
  return pares.reduce((menor, atual) => (atual.valor < menor.valor ? atual : menor), pares[0]);
}
