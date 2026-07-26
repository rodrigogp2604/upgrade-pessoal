import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloudIcon, FlameIcon, MoonIcon, SunIcon } from "./icons";
import { SyncSheet } from "./SyncSheet";
import { useAppTheme } from "@/theme/useAppTheme";
import { useGame } from "@/game/useGame";
import { useSync } from "@/sync/useSync";
import { ACCENT } from "@/theme/palette";

// Cabeçalho fixo do protótipo: marca, streak, estado do sync e o interruptor de tema.
export function Header() {
  const { top } = useSafeAreaInsets();
  const { isDark, palette, toggle } = useAppTheme();
  const { data } = useGame();
  const { estado, pendentes, conflitos } = useSync();
  const [painelAberto, setPainelAberto] = useState(false);

  // Uma cor por situação, para o estado do sync ser lido sem abrir nada.
  const corDaNuvem =
    conflitos > 0 ? palette.danger : estado === "ok" ? palette.accentInk : palette.faint;

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

          {/* estado da sincronização: cinza offline · âmbar em dia · vermelho com conflito */}
          <Pressable
            onPress={() => setPainelAberto(true)}
            className="h-[30px] w-[30px] items-center justify-center rounded-full bg-card active:scale-90"
          >
            {estado === "sincronizando" ? (
              <ActivityIndicator size="small" color={ACCENT} />
            ) : (
              <CloudIcon color={corDaNuvem} />
            )}
            {(pendentes > 0 || conflitos > 0) && estado !== "sincronizando" && (
              <View
                className="absolute -right-0.5 -top-0.5 h-[15px] min-w-[15px] items-center justify-center rounded-full px-[3px]"
                style={{ backgroundColor: conflitos > 0 ? palette.danger : ACCENT }}
              >
                <Text className="font-display text-[9px] text-white">{conflitos > 0 ? conflitos : pendentes}</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={toggle}
            className="h-[30px] w-[30px] items-center justify-center rounded-full bg-card active:scale-90"
          >
            {isDark ? <SunIcon /> : <MoonIcon color={palette.ink3} />}
          </Pressable>
        </View>
      </View>

      <SyncSheet visivel={painelAberto} fechar={() => setPainelAberto(false)} />
    </View>
  );
}
