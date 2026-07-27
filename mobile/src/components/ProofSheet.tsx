import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSQLiteContext } from "expo-sqlite";
import { useAppTheme } from "@/theme/useAppTheme";
import { useGame } from "@/game/useGame";
import { useSync } from "@/sync/useSync";
import { listarProvas, anexarProvaLocal, removerProvaLocal, type ProvaLocal } from "@/db/proofs";
import { apagarOriginal, escolherArquivo, escolherDaGaleria, tirarFoto, LIMITE_BYTES } from "@/proofs/capture";
import { ClipIcon } from "./icons";

const kb = (n: number | null) => (n ? `${Math.max(1, Math.round(n / 1024))} KB` : "");

// Anexar prova é o gesto mais frequente do app depois de concluir missão: três caminhos,
// tudo funcionando offline (o arquivo fica no aparelho e sobe na próxima sincronização).
export function ProofSheet({
  missionId,
  titulo,
  fechar,
}: {
  missionId: number | null;
  titulo: string;
  fechar: () => void;
}) {
  const { bottom } = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const db = useSQLiteContext();
  const { recarregar } = useGame();
  const { sincronizarAgora, estado } = useSync();

  const [provas, setProvas] = useState<ProvaLocal[]>([]);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    if (missionId == null) return;
    setProvas(await listarProvas(db, missionId));
  }, [db, missionId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const anexar = async (obter: () => Promise<Awaited<ReturnType<typeof tirarFoto>>>) => {
    if (missionId == null) return;
    setOcupado(true);
    try {
      const prova = await obter();
      if (!prova) return;

      if (prova.size > LIMITE_BYTES) {
        apagarOriginal(prova.uri);
        Alert.alert("Prova grande demais", "O limite é 25 MB por arquivo. Tente um print em vez do arquivo inteiro.");
        return;
      }

      await anexarProvaLocal(db, missionId, prova);
      await carregar();
      await recarregar();
      void sincronizarAgora(); // se o PC estiver perto, já sobe
    } catch {
      Alert.alert("Não consegui anexar", "Tente de novo. Se for um arquivo grande, use um print.");
    } finally {
      setOcupado(false);
    }
  };

  const remover = (prova: ProvaLocal) =>
    Alert.alert("Remover prova?", prova.originalName, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          const { arquivoParaApagar } = await removerProvaLocal(db, prova.id);
          if (arquivoParaApagar) apagarOriginal(arquivoParaApagar);
          await carregar();
          await recarregar();
          void sincronizarAgora();
        },
      },
    ]);

  const opcao = (rotulo: string, acao: () => void) => (
    <Pressable
      key={rotulo}
      onPress={acao}
      disabled={ocupado}
      className="flex-1 items-center rounded border-[1.5px] border-line py-3 active:border-accent"
    >
      <Text className="font-sans text-[12.5px] text-ink2">{rotulo}</Text>
    </Pressable>
  );

  return (
    <Modal visible={missionId != null} transparent animationType="slide" onRequestClose={fechar}>
      <Pressable className="flex-1 bg-black/45" onPress={fechar} />
      <View className="rounded-t-2xl bg-card px-4 pt-4" style={{ paddingBottom: Math.max(bottom, 16) + 8 }}>
        <View className="mb-1 flex-row items-center gap-2.5">
          <ClipIcon size={17} color={palette.accentInk} />
          <Text className="flex-1 font-display text-[16px] tracking-[1.6px] text-ink">PROVAS</Text>
          <Pressable onPress={fechar} hitSlop={10}>
            <Text className="font-sans text-[13px] text-ink3">fechar</Text>
          </Pressable>
        </View>
        <Text numberOfLines={2} className="mb-3 font-sans text-[12px] leading-[17px] text-ink2">
          {titulo}
        </Text>

        {provas.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            <View className="flex-row gap-2">
              {provas.map((p) => (
                <Pressable key={p.id} onLongPress={() => remover(p)} className="w-[84px]">
                  <View className="h-[84px] w-[84px] items-center justify-center overflow-hidden rounded bg-soft">
                    {p.localUri && (p.mimeType ?? "").startsWith("image/") ? (
                      <Image source={{ uri: p.localUri }} style={{ width: 84, height: 84 }} resizeMode="cover" />
                    ) : (
                      <ClipIcon size={22} color={palette.faint} />
                    )}
                  </View>
                  <Text numberOfLines={1} className="mt-1 font-sans text-[10px] text-ink3">
                    {p.originalName}
                  </Text>
                  <Text className="font-sans text-[9.5px] text-faint">
                    {p.id < 0 ? "na fila" : kb(p.size)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        <View className="flex-row gap-2">
          {opcao("Câmera", () => void anexar(tirarFoto))}
          {opcao("Galeria", () => void anexar(escolherDaGaleria))}
          {opcao("Arquivo", () => void anexar(escolherArquivo))}
        </View>

        {ocupado && (
          <View className="mt-3 flex-row items-center justify-center gap-2">
            <ActivityIndicator size="small" color={palette.accentInk} />
            <Text className="font-sans text-[12px] text-ink2">preparando a prova…</Text>
          </View>
        )}

        <Text className="mt-3 font-sans text-[11px] leading-[16px] text-faint">
          Imagem é reduzida para caber no Wi-Fi de casa. Tudo fica no aparelho e sobe na próxima
          sincronização{estado === "offline" ? " (o PC não está ao alcance agora)" : ""}. Toque e segure
          uma prova para remover.
        </Text>
      </View>
    </Modal>
  );
}
