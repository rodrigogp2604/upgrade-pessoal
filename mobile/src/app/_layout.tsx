import "@/global.css";

import { useEffect, useState } from "react";
import { View } from "react-native";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { useColorScheme } from "nativewind";
import { useFonts, Rajdhani_600SemiBold, Rajdhani_700Bold } from "@expo-google-fonts/rajdhani";
import { IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold } from "@expo-google-fonts/ibm-plex-sans";
import { GameProvider } from "@/game/useGame";
import { useAppTheme, CHAVE_TEMA } from "@/theme/useAppTheme";
import { migrate } from "@/db/schema";
import { getSyncState } from "@/db/repo";

SplashScreen.preventAutoHideAsync();

export const DB_NAME = "upgrade.db";

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
      <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
        <TemaSalvo>
          <GameProvider>
            <Fundo />
          </GameProvider>
        </TemaSalvo>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

// Aplica o tema escolhido antes de pintar a primeira tela — sem isso o app abre claro
// e vira escuro meio segundo depois, o que parece defeito.
function TemaSalvo({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const { setColorScheme } = useColorScheme();
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    void (async () => {
      const salvo = await getSyncState(db, CHAVE_TEMA);
      if (salvo === "dark" || salvo === "light") setColorScheme(salvo);
      setPronto(true);
    })();
  }, [db, setColorScheme]);

  if (!pronto) return null;
  return <>{children}</>;
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
