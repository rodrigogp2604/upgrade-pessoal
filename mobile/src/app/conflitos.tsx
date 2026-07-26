import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { useAppTheme } from "@/theme/useAppTheme";

type Conflito = {
  opId: string;
  entity: string;
  entityId: string;
  reason: string;
  mineLabel: string;
  theirsLabel: string;
  createdAt: string;
};

const MOTIVO: Record<string, string> = {
  status_changed: "O PC mexeu nesta missão depois de você",
  value_changed: "O valor mudou no PC depois de você",
  possible_duplicate: "Pode ser o mesmo lançamento contado duas vezes",
};

// Lista o que o PC não aceitou aplicar sozinho. Os botões de escolher um lado entram na
// Fase 7 — aqui o app já mostra os dois lados e não sobrescreve nada.
export default function ConflitosScreen() {
  const { top } = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const [lista, setLista] = useState<Conflito[]>([]);

  const carregar = useCallback(async () => {
    setLista(await db.getAllAsync<Conflito>("SELECT * FROM conflicts ORDER BY createdAt ASC"));
  }, [db]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <View className="flex-1 bg-bg1" style={{ paddingTop: top + 8 }}>
      <View className="flex-row items-center gap-3 px-4 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="font-sans text-[13px] text-accentInk">voltar</Text>
        </Pressable>
        <Text className="font-display text-[17px] tracking-[2px] text-ink">CONFLITOS</Text>
      </View>

      <ScrollView contentContainerClassName="px-4 pb-8">
        {lista.length === 0 ? (
          <Text className="mt-6 text-center font-sans text-[13px] leading-[19px] text-ink2">
            Nenhum conflito. Quando o PC e o celular discordarem do mesmo registro, a decisão aparece aqui.
          </Text>
        ) : (
          <>
            <Text className="mb-3 font-sans text-[12.5px] leading-[18px] text-ink2">
              Nada foi sobrescrito. Cada item abaixo espera sua escolha.
            </Text>

            {lista.map((c) => (
              <View key={c.opId} className="mb-2.5 rounded-md border border-cardLine bg-card p-3.5">
                <Text className="font-semibold text-[10px] tracking-[1.4px] text-accentInk">
                  {(MOTIVO[c.reason] ?? c.reason).toUpperCase()}
                </Text>

                <View className="mt-2.5 gap-2">
                  <View className="rounded bg-soft px-3 py-2.5">
                    <Text className="font-semibold text-[10px] tracking-[1.2px] text-ink3">📱 CELULAR</Text>
                    <Text className="mt-0.5 font-sans text-[13px] leading-[18px] text-ink">{c.mineLabel}</Text>
                  </View>
                  <View className="rounded bg-soft px-3 py-2.5">
                    <Text className="font-semibold text-[10px] tracking-[1.2px] text-ink3">💻 PC</Text>
                    <Text className="mt-0.5 font-sans text-[13px] leading-[18px] text-ink">{c.theirsLabel}</Text>
                  </View>
                </View>

                <Text className="mt-2.5 font-sans text-[11px] text-faint">
                  Escolher um lado chega na próxima etapa do app.
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
