import { useColorScheme } from "nativewind";
import { useSQLiteContext } from "expo-sqlite";
import { setSyncState } from "@/db/repo";
import { PALETTES, type Palette } from "./palette";

export const CHAVE_TEMA = "theme";

// Tema é preferência do aparelho e NÃO sincroniza (decisão D12): cada tela tem sua luz.
// Por isso a escolha mora em `sync_state` local, não em Setting do jogo.
export function useAppTheme(): {
  scheme: "light" | "dark";
  isDark: boolean;
  palette: Palette;
  toggle: () => void;
} {
  const db = useSQLiteContext();
  const { colorScheme, setColorScheme } = useColorScheme();
  const scheme = colorScheme === "dark" ? "dark" : "light";

  return {
    scheme,
    isDark: scheme === "dark",
    palette: PALETTES[scheme],
    toggle: () => {
      const proximo = scheme === "dark" ? "light" : "dark";
      setColorScheme(proximo);
      void setSyncState(db, CHAVE_TEMA, proximo);
    },
  };
}
