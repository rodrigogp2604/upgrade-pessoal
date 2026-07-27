import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSync } from "@/sync/useSync";
import { useAppTheme } from "@/theme/useAppTheme";
import { ACCENT } from "@/theme/palette";
import { CloudIcon, RefreshIcon } from "./icons";

function quando(iso: string | null): string {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.round(min / 60)} h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

const FRASE: Record<string, string> = {
  nao_pareado: "Este aparelho ainda não está pareado com o PC.",
  offline: "O PC não está ao alcance. Tudo que você fizer fica guardado aqui.",
  sincronizando: "Sincronizando…",
  ok: "Em dia com o PC.",
  conflitos: "Há decisões esperando você.",
  erro: "Algo deu errado na conversa com o PC.",
};

export function SyncSheet({ visivel, fechar }: { visivel: boolean; fechar: () => void }) {
  const { bottom } = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const router = useRouter();
  const {
    estado, mensagem, pendentes, conflitos, ultimaSync, pareamento,
    sincronizarAgora, procurarPc, procurando, despareamento, mudarHost,
    atualizacao, baixarAtualizacao,
  } = useSync();

  const [editandoIp, setEditandoIp] = useState(false);
  const [ip, setIp] = useState(pareamento?.host ?? "");
  const [aviso, setAviso] = useState<string | null>(null);

  const linha = "flex-row items-center justify-center gap-2 rounded py-3.5";

  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={fechar}>
      <Pressable className="flex-1 bg-black/45" onPress={fechar} />
      <View className="rounded-t-2xl bg-card px-4 pt-4" style={{ paddingBottom: Math.max(bottom, 16) + 8 }}>
        <View className="mb-3 flex-row items-center gap-2.5">
          <CloudIcon size={20} color={palette.accentInk} />
          <Text className="flex-1 font-display text-[17px] tracking-[2px] text-ink">SINCRONIZAÇÃO</Text>
          <Pressable onPress={fechar} hitSlop={10}>
            <Text className="font-sans text-[13px] text-ink3">fechar</Text>
          </Pressable>
        </View>

        <Text className="font-sans text-[12.5px] leading-[18px] text-ink2">
          {mensagem ?? FRASE[estado] ?? ""}
        </Text>

        <View className="mt-3 flex-row gap-2.5">
          <View className="flex-1 rounded bg-soft px-3 py-2.5">
            <Text className="font-semibold text-[10px] tracking-[1.4px] text-ink3">NA FILA</Text>
            <Text className="font-display text-[19px] text-ink">{pendentes}</Text>
          </View>
          <View className="flex-1 rounded bg-soft px-3 py-2.5">
            <Text className="font-semibold text-[10px] tracking-[1.4px] text-ink3">CONFLITOS</Text>
            <Text className="font-display text-[19px]" style={{ color: conflitos > 0 ? palette.danger : palette.ink }}>
              {conflitos}
            </Text>
          </View>
          <View className="flex-1 rounded bg-soft px-3 py-2.5">
            <Text className="font-semibold text-[10px] tracking-[1.4px] text-ink3">ÚLTIMA</Text>
            <Text className="font-sans text-[12px] text-ink">{quando(ultimaSync)}</Text>
          </View>
        </View>

        {atualizacao && (
          <Pressable
            onPress={baixarAtualizacao}
            className={`${linha} mt-3 border-[1.5px] border-accent bg-amberSoft`}
          >
            <Text className="font-display text-[14px] tracking-[1.2px] text-accentInk">
              NOVA VERSÃO ({atualizacao.versao}) · TOCAR PARA ATUALIZAR
            </Text>
          </Pressable>
        )}

        {conflitos > 0 && (
          <Pressable
            onPress={() => {
              fechar();
              router.push("/conflitos");
            }}
            className={`${linha} mt-3`}
            style={{ backgroundColor: palette.danger }}
          >
            <Text className="font-display text-[15px] tracking-[1.4px] text-white">
              RESOLVER CONFLITOS ({conflitos})
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => void sincronizarAgora()}
          disabled={estado === "sincronizando"}
          className={`${linha} mt-2.5 bg-accent active:scale-[0.99]`}
        >
          {estado === "sincronizando" ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <RefreshIcon size={15} color="#fff" />
          )}
          <Text className="font-display text-[15px] tracking-[1.4px] text-white">
            {estado === "sincronizando" ? "SINCRONIZANDO…" : "SINCRONIZAR AGORA"}
          </Text>
        </Pressable>

        {pareamento ? (
          <>
            <View className="mt-3.5 border-t border-line pt-3">
              <Text className="font-semibold text-[10px] tracking-[1.4px] text-ink3">PC PAREADO</Text>
              {editandoIp ? (
                <View className="mt-2 flex-row gap-2">
                  <TextInput
                    value={ip}
                    onChangeText={setIp}
                    autoCapitalize="none"
                    keyboardType="numbers-and-punctuation"
                    placeholder="192.168.0.14"
                    placeholderTextColor={palette.faint}
                    className="flex-1 rounded border-[1.5px] border-line bg-field px-3 py-2.5 font-sans text-[14px] text-ink"
                  />
                  <Pressable
                    onPress={async () => {
                      await mudarHost(ip.trim(), pareamento.port);
                      setEditandoIp(false);
                    }}
                    className="justify-center rounded bg-panel px-4"
                  >
                    <Text className="font-display text-[13px] tracking-[1.2px] text-panelInk">OK</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => setEditandoIp(true)} className="mt-1 flex-row items-center gap-2">
                  <Text className="font-sans text-[13px] text-ink">
                    {pareamento.host}:{pareamento.port}
                  </Text>
                  <Text className="font-sans text-[11.5px] text-accentInk">trocar</Text>
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={async () => {
                setAviso(null);
                const achado = await procurarPc();
                setAviso(achado ? `PC encontrado em ${achado}` : "não achei o PC nesta rede");
              }}
              disabled={Boolean(procurando)}
              className="mt-2.5 flex-row items-center justify-center gap-2 rounded border-[1.5px] border-line py-3"
            >
              {procurando ? <ActivityIndicator size="small" color={ACCENT} /> : null}
              <Text className="font-sans text-[13px] text-ink2">
                {procurando
                  ? `procurando na rede… ${procurando.testados}/${procurando.total}`
                  : "Procurar PC na rede"}
              </Text>
            </Pressable>

            {aviso && <Text className="mt-2 text-center font-sans text-[11.5px] text-accentInk">{aviso}</Text>}

            <Pressable
              onPress={async () => {
                await despareamento();
                fechar();
                router.push("/parear");
              }}
              className="mt-1 items-center py-2.5"
            >
              <Text className="font-sans text-[12px] text-faint">parear de novo (lê o QR do painel)</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={() => {
              fechar();
              router.push("/parear");
            }}
            className={`${linha} mt-2.5 border-[1.5px] border-accent`}
          >
            <Text className="font-display text-[15px] tracking-[1.4px] text-accentInk">PAREAR COM O PC</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}
