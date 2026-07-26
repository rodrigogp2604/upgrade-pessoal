import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useGame } from "@/game/useGame";
import { useAppTheme } from "@/theme/useAppTheme";
import { ClipIcon } from "@/components/icons";

// Histórico dos andares. Só leitura: estrelas e review são escritas no ritual de domingo,
// no PC, com o cowork.
export default function TorreScreen() {
  const { palette } = useAppTheme();
  const { data, activeWeek } = useGame();
  const [aberto, setAberto] = useState<number | null>(null);

  const andares = [...data.weeks].sort((a, b) => b.floor - a.floor);
  const topo = data.titles.reduce((maior, t) => (t.level > maior.level ? t : maior), data.titles[0]);

  const provasDoArco = (weekId: number) =>
    data.attachments.filter((a) => data.missions.some((m) => m.id === a.missionId && m.weekId === weekId)).length;

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-4 pb-6" showsVerticalScrollIndicator={false}>
      <Text className="mt-1 font-display text-[20px] tracking-[2.6px] text-ink">A TORRE</Text>
      <Text className="mb-3 mt-[3px] font-sans text-[12px] text-ink3">
        Cada andar é uma semana. Toque para ver a avaliação.
      </Text>

      {topo && (
        <Text className="px-2.5 py-1.5 text-center font-sans text-[11px] leading-[16px] text-faint2">
          ⋯ Andar {topo.level} — {topo.name} — no topo da névoa ⋯
        </Text>
      )}

      <View className="gap-[7px]">
        {andares.map((w) => {
          const ativo = w.id === activeWeek?.id;
          const expandido = aberto === w.id;
          const missoes = data.missions.filter((m) => m.weekId === w.id);
          const feitas = missoes.filter((m) => m.status === "done").length;

          return (
            <View key={w.id}>
              <Pressable
                onPress={() => setAberto(expandido ? null : w.id)}
                className={`flex-row items-center gap-2.5 px-3 py-3 active:scale-[0.99] ${
                  ativo ? "rounded-md bg-panel" : expandido ? "rounded-t-md border border-line bg-surf" : "rounded-md border border-line bg-surf"
                }`}
              >
                <Text className={`w-[26px] text-center font-display text-[18px] ${ativo ? "text-accent" : "text-ink"}`}>
                  {w.floor}
                </Text>
                <View className="min-w-0 flex-1">
                  <Text className={`font-semibold text-[13.5px] ${ativo ? "text-panelInk" : "text-ink"}`}>{w.theme}</Text>
                  <Text className={`font-sans text-[11px] ${ativo ? "text-panelMute" : "text-ink3"}`}>
                    {ativo ? `em andamento · ${feitas}/${missoes.length} missões` : `${feitas}/${missoes.length} missões`}
                  </Text>
                </View>
                <Text className={`flex-none text-[12px] tracking-[1px] ${ativo ? "text-accent" : "text-accentInk"}`}>
                  {ativo ? "AGORA" : w.rating ? "★".repeat(w.rating) + "☆".repeat(5 - w.rating) : "—"}
                </Text>
              </Pressable>

              {expandido && (
                <View className="rounded-b-md border border-t-0 border-line bg-soft px-3.5 py-3">
                  <Text className="font-sans text-[12px] leading-[18px] text-ink2">
                    {w.review ?? (ativo ? "Arco em andamento — a avaliação vem no domingo, com o cowork." : "Sem review registrada.")}
                  </Text>
                  <View className="mt-2 flex-row items-center gap-1.5">
                    <ClipIcon size={12} color={palette.faint} />
                    <Text className="font-sans text-[11.5px] text-faint">
                      Espólio: {provasDoArco(w.id)} provas arquivadas
                    </Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
