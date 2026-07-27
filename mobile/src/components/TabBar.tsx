import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BossTabIcon, IncomeTabIcon, MissionsTabIcon, StatusTabIcon, TowerTabIcon } from "./icons";
import { useAppTheme } from "@/theme/useAppTheme";
import { ACCENT } from "@/theme/palette";

// Barra de 5 abas desenhada à mão para bater com o protótipo (a barra nativa não
// permite esse controle de cor, peso e espaçamento).
const ICONES: Record<string, (p: { color: string }) => React.ReactElement> = {
  index: (p) => <MissionsTabIcon {...p} />,
  status: (p) => <StatusTabIcon {...p} />,
  torre: (p) => <TowerTabIcon {...p} />,
  chefoes: (p) => <BossTabIcon {...p} />,
  renda: (p) => <IncomeTabIcon {...p} />,
};

const ROTULOS: Record<string, string> = {
  index: "Missões",
  status: "Status",
  torre: "Torre",
  chefoes: "Chefões",
  renda: "Renda",
};

// Tipado pelo que a barra realmente usa, em vez de importar os tipos que o expo-router
// embute internamente (`build/react-navigation/...`): caminho interno quebra em upgrade.
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

export function TabBar({ state, navigation }: TabBarProps) {
  const { bottom } = useSafeAreaInsets();
  const { palette } = useAppTheme();

  return (
    <View
      className="flex-row border-t border-line bg-navBg px-2 pt-2"
      style={{ paddingBottom: Math.max(bottom, 10) }}
    >
      {state.routes.map((route, i) => {
        const ativa = state.index === i;
        const cor = ativa ? ACCENT : palette.ink3;
        const Icone = ICONES[route.name];
        if (!Icone) return null;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={ativa ? { selected: true } : {}}
            accessibilityLabel={ROTULOS[route.name]}
            onPress={() => {
              if (!ativa) navigation.navigate(route.name);
            }}
            className="flex-1 items-center gap-1 py-1 active:opacity-60"
          >
            <Icone color={cor} />
            <Text className="font-medium text-[10.5px]" style={{ color: cor }}>
              {ROTULOS[route.name]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
