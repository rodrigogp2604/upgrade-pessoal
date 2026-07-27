import { ScrollView, Text, View } from "react-native";
import { useGame } from "@/game/useGame";
import { useAppTheme } from "@/theme/useAppTheme";
import { AvatarInitials, ProgressBar, XpRing } from "@/components/ui";
import { Radar, pontoFraco } from "@/components/Radar";
import { StarIcon } from "@/components/icons";

export default function StatusScreen() {
  const { palette } = useAppTheme();
  const { data, level, title, power, xpInto, xpPct, nextTitleLevel } = useGame();
  const fraco = pontoFraco(data.character.stats);

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-4 pb-6" showsVerticalScrollIndicator={false}>
      <View className="items-center pb-1 pt-1.5">
        <View className="relative">
          <XpRing size={132} pct={xpPct} thickness={5} trackColor={palette.track}>
            <AvatarInitials name={data.character.name} size={132} />
          </XpRing>
          <View className="absolute -bottom-2.5 left-0 right-0 items-center">
            <View className="rounded-xl bg-panel px-3 py-[3px]">
              <Text className="font-display text-[13px] tracking-[1px] text-panelInk">NV. {level}</Text>
            </View>
          </View>
        </View>

        <Text className="mt-4 font-display text-[22px] tracking-[1.8px] text-ink">{data.character.name}</Text>
        <View className="mt-1 flex-row items-center gap-1.5 rounded-2xl bg-card px-3.5 py-1.5">
          <StarIcon />
          <Text className="font-semibold text-[12.5px] text-accentInk">{title ?? "sem título ainda"}</Text>
        </View>
      </View>

      <View className="mt-3.5 rounded-md border border-cardLine bg-card px-4 py-3.5">
        <View className="mb-1.5 flex-row justify-between">
          <Text className="font-sans text-[11.5px] text-ink3">XP {xpInto}/100</Text>
          <Text className="font-sans text-[11.5px] text-ink3">NV. {level + 1}</Text>
        </View>
        <ProgressBar pct={xpPct} height={8} />

        <View className="mt-3.5 flex-row gap-2.5">
          <View className="flex-1 rounded bg-soft px-3 py-2.5">
            <Text className="font-semibold text-[10px] tracking-[1.4px] text-ink3">ANDAR DA TORRE</Text>
            <Text className="font-display text-[21px] text-ink">{level}</Text>
          </View>
          <View className="flex-1 rounded bg-soft px-3 py-2.5">
            <Text className="font-semibold text-[10px] tracking-[1.4px] text-ink3">PODER TOTAL</Text>
            <Text className="font-display text-[21px] text-ink">
              {power} <Text className="font-sans text-[12px] text-faint2">/ 600</Text>
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-3">
        <Radar stats={data.character.stats} />
      </View>

      <View className="mt-3 rounded-md border border-accent/40 bg-amberSoft px-3.5 py-3">
        <Text className="font-sans text-[12px] leading-[18px] text-ink2">
          Ponto fraco atual: <Text className="font-semibold text-accentInk">{fraco.nome} ({fraco.valor}/100)</Text> — as
          missões deste andar atacam exatamente isso.
          {nextTitleLevel ? ` Próximo título no nível ${nextTitleLevel}.` : ""}
        </Text>
      </View>
    </ScrollView>
  );
}
