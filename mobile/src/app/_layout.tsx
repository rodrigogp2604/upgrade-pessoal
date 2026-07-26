import "@/global.css";

import { useEffect } from "react";
import { View } from "react-native";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts, Rajdhani_600SemiBold, Rajdhani_700Bold } from "@expo-google-fonts/rajdhani";
import { IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold } from "@expo-google-fonts/ibm-plex-sans";
import { GameProvider } from "@/game/useGame";
import { useAppTheme } from "@/theme/useAppTheme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontesProntas, erroFonte] = useFonts({
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
  });

  useEffect(() => {
    if (fontesProntas || erroFonte) void SplashScreen.hideAsync();
  }, [fontesProntas, erroFonte]);

  // Rajdhani é a cara do jogo: melhor esperar meio segundo do que piscar em Arial.
  if (!fontesProntas && !erroFonte) return null;

  return (
    <SafeAreaProvider>
      <GameProvider>
        <Fundo />
      </GameProvider>
    </SafeAreaProvider>
  );
}

// O protótipo usa um degradê de papel quente no fundo. Sem biblioteca de gradiente:
// três faixas empilhadas dão a mesma sensação e não somam dependência nativa.
function Fundo() {
  const { isDark, palette } = useAppTheme();

  return (
    <View className="flex-1 bg-bg1">
      <View className="absolute inset-0">
        <View className="flex-1" style={{ backgroundColor: palette.bg[0] }} />
        <View className="flex-1" style={{ backgroundColor: palette.bg[1] }} />
        <View className="flex-1" style={{ backgroundColor: palette.bg[2] }} />
      </View>

      {/* fio âmbar do topo, marca do protótipo */}
      <View className="absolute left-0 right-0 top-0 z-10 h-[3px] bg-accent" />

      <StatusBar style={isDark ? "light" : "dark"} />
      <Slot />
    </View>
  );
}
