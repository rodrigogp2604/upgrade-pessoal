import { useColorScheme } from "nativewind";
import { PALETTES, type Palette } from "./palette";

// Tema é preferência do aparelho e NÃO sincroniza (decisão D12 do plano): cada tela
// tem sua luz. A persistência entre aberturas entra na Fase 5, junto com o SQLite.
export function useAppTheme(): {
  scheme: "light" | "dark";
  isDark: boolean;
  palette: Palette;
  toggle: () => void;
} {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const scheme = colorScheme === "dark" ? "dark" : "light";

  return {
    scheme,
    isDark: scheme === "dark",
    palette: PALETTES[scheme],
    toggle: toggleColorScheme,
  };
}
