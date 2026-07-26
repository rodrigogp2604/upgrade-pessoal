import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { useAppTheme } from "@/theme/useAppTheme";
import { useSync } from "@/sync/useSync";
import { useGame } from "@/game/useGame";
import { listarConflitos, resolverTodos, type Conflito, type Lado } from "@/db/conflicts";
import { ACCENT } from "@/theme/palette";

const MOTIVO: Record<string, string> = {
  status_changed: "O PC mexeu nesta missão depois de você",
  value_changed: "O valor mudou no PC depois de você",
  possible_duplicate: "Pode ser o mesmo lançamento contado duas vezes",
};

// Nada aqui foi aplicado: cada card espera uma escolha. Só ao confirmar as escolhas o app
// reenvia (forçando) ou desiste e busca a verdade do PC.
export default function ConflitosScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const { sincronizarAgora } = useSync();
  const { recarregar } = useGame();

  const [lista, setLista] = useState<Conflito[]>([]);
  const [escolhas, setEscolhas] = useState<Record<string, Lado>>({});
  const [aplicando, setAplicando] = useState(false);

  const carregar = useCallback(async () => {
    setLista(await listarConflitos(db));
    setEscolhas({});
  }, [db]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const escolher = (opId: string, lado: Lado) =>
    setEscolhas((atual) => ({ ...atual, [opId]: atual[opId] === lado ? undefined! : lado }));

  const todos = (lado: Lado) =>
    setEscolhas(Object.fromEntries(lista.map((c) => [c.opId, lado])) as Record<string, Lado>);

  const quantasEscolhas = Object.values(escolhas).filter(Boolean).length;

  const aplicar = async () => {
    setAplicando(true);
    try {
      await resolverTodos(
        db,
        Object.entries(escolhas)
          .filter(([, lado]) => Boolean(lado))
          .map(([opId, lado]) => ({ opId, lado }))
      );
      await sincronizarAgora();
      await recarregar();
      await carregar();
    } finally {
      setAplicando(false);
    }
  };

  const botao = (opId: string, lado: Lado, rotulo: string) => {
    const ativo = escolhas[opId] === lado;
    return (
      <Pressable
        onPress={() => escolher(opId, lado)}
        className={`flex-1 items-center rounded border-[1.5px] py-2.5 ${ativo ? "border-accent bg-accent" : "border-line"}`}
      >
        <Text className={`font-display text-[13px] tracking-[1px] ${ativo ? "text-white" : "text-ink2"}`}>{rotulo}</Text>
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-bg1" style={{ paddingTop: top + 8 }}>
      <View className="flex-row items-center gap-3 px-4 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="font-sans text-[13px] text-accentInk">voltar</Text>
        </Pressable>
        <Text className="font-display text-[17px] tracking-[2px] text-ink">
          CONFLITOS{lista.length > 0 ? ` (${lista.length})` : ""}
        </Text>
      </View>

      <ScrollView contentContainerClassName="px-4 pb-6" showsVerticalScrollIndicator={false}>
        {lista.length === 0 ? (
          <Text className="mt-6 text-center font-sans text-[13px] leading-[19px] text-ink2">
            Nenhum conflito. Quando o PC e o celular discordarem do mesmo registro, a decisão aparece aqui —
            e nada é sobrescrito até você escolher.
          </Text>
        ) : (
          <>
            <Text className="mb-2.5 font-sans text-[12.5px] leading-[18px] text-ink2">
              Nada foi aplicado ainda. Escolha um lado de cada item.
            </Text>

            <View className="mb-3 flex-row gap-2">
              <Pressable onPress={() => todos("celular")} className="flex-1 items-center rounded bg-soft py-2">
                <Text className="font-sans text-[12px] text-ink2">usar tudo do celular</Text>
              </Pressable>
              <Pressable onPress={() => todos("pc")} className="flex-1 items-center rounded bg-soft py-2">
                <Text className="font-sans text-[12px] text-ink2">usar tudo do PC</Text>
              </Pressable>
            </View>

            {lista.map((c) => (
              <View key={c.opId} className="mb-2.5 rounded-md border border-cardLine bg-card p-3.5">
                <Text className="font-semibold text-[10px] tracking-[1.4px] text-accentInk">
                  {(MOTIVO[c.reason] ?? c.reason).toUpperCase()}
                </Text>

                <View className="mt-2.5 gap-2">
                  <View
                    className="rounded px-3 py-2.5"
                    style={{ backgroundColor: escolhas[c.opId] === "celular" ? "rgba(242,164,28,0.12)" : palette.soft }}
                  >
                    <Text className="font-semibold text-[10px] tracking-[1.2px] text-ink3">📱 CELULAR</Text>
                    <Text className="mt-0.5 font-sans text-[13px] leading-[18px] text-ink">{c.mineLabel}</Text>
                  </View>
                  <View
                    className="rounded px-3 py-2.5"
                    style={{ backgroundColor: escolhas[c.opId] === "pc" ? "rgba(242,164,28,0.12)" : palette.soft }}
                  >
                    <Text className="font-semibold text-[10px] tracking-[1.2px] text-ink3">💻 PC</Text>
                    <Text className="mt-0.5 font-sans text-[13px] leading-[18px] text-ink">{c.theirsLabel}</Text>
                  </View>
                </View>

                <View className="mt-2.5 flex-row gap-2">
                  {botao(c.opId, "celular", "USAR CELULAR")}
                  {botao(c.opId, "pc", "USAR PC")}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {lista.length > 0 && (
        <View className="border-t border-line bg-card px-4 pt-3" style={{ paddingBottom: Math.max(bottom, 12) }}>
          <Pressable
            onPress={() => void aplicar()}
            disabled={quantasEscolhas === 0 || aplicando}
            className="flex-row items-center justify-center gap-2 rounded py-3.5"
            style={{ backgroundColor: quantasEscolhas === 0 ? palette.line : ACCENT }}
          >
            {aplicando && <ActivityIndicator size="small" color="#fff" />}
            <Text
              className="font-display text-[15px] tracking-[1.4px]"
              style={{ color: quantasEscolhas === 0 ? palette.faint : "#fff" }}
            >
              {aplicando
                ? "APLICANDO…"
                : quantasEscolhas === 0
                  ? "ESCOLHA UM LADO"
                  : `APLICAR ${quantasEscolhas} ESCOLHA${quantasEscolhas > 1 ? "S" : ""}`}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
