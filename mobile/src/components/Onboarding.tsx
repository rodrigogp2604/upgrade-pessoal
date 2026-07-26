import { Pressable, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useGame } from "@/game/useGame";
import { seedDev, wipeLocal } from "@/db/devSeed";
import { CloudIcon } from "./icons";
import { useAppTheme } from "@/theme/useAppTheme";

// O app nasce vazio de propósito: quem enche é o pull do PC. Esta é a tela até lá.
export function Onboarding() {
  const db = useSQLiteContext();
  const { palette } = useAppTheme();
  const { recarregar } = useGame();

  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="h-[62px] w-[62px] items-center justify-center rounded-full bg-card">
        <CloudIcon size={28} color={palette.accentInk} />
      </View>

      <Text className="mt-5 text-center font-display text-[21px] tracking-[1.6px] text-ink">
        NENHUM PERSONAGEM AQUI AINDA
      </Text>

      <Text className="mt-3 text-center font-sans text-[13px] leading-[20px] text-ink2">
        Este aparelho ainda não recebeu seu jogo. Abra o painel no PC, entre em{" "}
        <Text className="font-semibold text-accentInk">Parear celular</Text> e aponte a câmera para o QR.
      </Text>

      <Text className="mt-3 text-center font-sans text-[11.5px] leading-[17px] text-faint">
        Depois do pareamento tudo funciona sem internet: as missões, as provas e os ataques
        ficam guardados aqui e sobem quando você voltar para a mesma rede.
      </Text>

      {__DEV__ && (
        <View className="mt-8 w-full gap-2 border-t border-line pt-5">
          <Text className="text-center font-semibold text-[10px] tracking-[1.4px] text-faint">
            SÓ EM DESENVOLVIMENTO
          </Text>
          <Pressable
            onPress={async () => {
              await seedDev(db);
              await recarregar();
            }}
            className="items-center rounded border-[1.5px] border-accent py-3 active:bg-accent"
          >
            <Text className="font-display text-[14px] tracking-[1.2px] text-accentInk">CARREGAR DADOS DE EXEMPLO</Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              await wipeLocal(db);
              await recarregar();
            }}
            className="items-center py-2"
          >
            <Text className="font-sans text-[12px] text-faint">limpar banco local</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
