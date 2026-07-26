import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloudIcon, FlameIcon, MoonIcon, SunIcon } from "./icons";
import { useAppTheme } from "@/theme/useAppTheme";
import { useGame } from "@/game/useGame";

// Cabeçalho fixo do protótipo: marca, streak, estado do sync e o interruptor de tema.
export function Header() {
  const { top } = useSafeAreaInsets();
  const { isDark, palette, toggle } = useAppTheme();
  const { data } = useGame();

  return (
    <View style={{ paddingTop: top + 6 }} className="flex-none px-4 pb-2.5">
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-row items-center gap-2.5">
          {/* losango da marca */}
          <View className="h-[22px] w-[22px] items-center justify-center rounded-[3px] bg-accent" style={{ transform: [{ rotate: "45deg" }] }}>
            <View className="h-2 w-2 rounded-[1px] bg-card" />
          </View>
          <Text numberOfLines={1} className="font-display text-[15px] tracking-[2.4px] text-ink">
            UPGRADE PESSOAL
          </Text>
        </View>

        <View className="flex-none flex-row items-center gap-1.5">
          <View className="flex-row items-center gap-1.5 rounded-2xl bg-card px-2.5 py-1">
            <FlameIcon />
            <Text className="font-display text-[14px] text-ink">{data.streak}</Text>
          </View>

          {/* estado da sincronização — ganha vida na Fase 6 */}
          <View className="h-[30px] w-[30px] items-center justify-center rounded-full bg-card">
            <CloudIcon color={palette.faint} />
          </View>

          <Pressable
            onPress={toggle}
            className="h-[30px] w-[30px] items-center justify-center rounded-full bg-card active:scale-90"
          >
            {isDark ? <SunIcon /> : <MoonIcon color={palette.ink3} />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
