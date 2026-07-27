import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSync } from "@/sync/useSync";
import { useAppTheme } from "@/theme/useAppTheme";
import { parseQr } from "@/sync/pairing";

// Pareamento em um toque: o painel do PC mostra o QR com endereço + token, o app lê e
// guarda. Digitar na mão existe como plano B (QR ilegível, câmera negada).
export default function PairScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const router = useRouter();
  const { parear } = useSync();

  const [permissao, pedirPermissao] = useCameraPermissions();
  const [manual, setManual] = useState(false);
  const [host, setHost] = useState("");
  const [token, setToken] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [lido, setLido] = useState(false);

  const concluir = async (dados: { host: string; port: number; token: string }) => {
    await parear(dados);
    router.back();
  };

  const aoLerCodigo = ({ data }: { data: string }) => {
    if (lido) return;
    const p = parseQr(data);
    if (!p) {
      setErro("esse QR não é o do painel do Upgrade Pessoal");
      return;
    }
    setLido(true); // a câmera dispara em rajada; sem isso parearia várias vezes
    void concluir(p);
  };

  return (
    <View className="flex-1 bg-bg1" style={{ paddingTop: top + 8 }}>
      <View className="flex-row items-center gap-3 px-4 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text className="font-sans text-[13px] text-accentInk">voltar</Text>
        </Pressable>
        <Text className="font-display text-[17px] tracking-[2px] text-ink">PAREAR COM O PC</Text>
      </View>

      {!manual ? (
        <View className="flex-1 px-4">
          <Text className="font-sans text-[12.5px] leading-[18px] text-ink2">
            No PC, abra o painel e clique no ícone de celular →{" "}
            <Text className="font-semibold text-accentInk">Parear celular</Text>. Aponte a câmera para o QR.
          </Text>

          <View className="mt-3.5 flex-1 overflow-hidden rounded-lg bg-panel">
            {permissao?.granted ? (
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={aoLerCodigo}
              />
            ) : (
              <View className="flex-1 items-center justify-center px-8">
                <Text className="text-center font-sans text-[13px] leading-[19px] text-panelInk">
                  Para ler o QR, o app precisa da câmera.
                </Text>
                <Pressable
                  onPress={() => void pedirPermissao()}
                  className="mt-4 rounded border-[1.5px] border-accent px-5 py-3"
                >
                  <Text className="font-display text-[14px] tracking-[1.2px] text-accent">PERMITIR CÂMERA</Text>
                </Pressable>
              </View>
            )}
          </View>

          {erro && <Text className="mt-2.5 text-center font-sans text-[12px] text-danger">{erro}</Text>}

          <Pressable onPress={() => setManual(true)} className="items-center py-4" style={{ marginBottom: bottom }}>
            <Text className="font-sans text-[12.5px] text-faint">digitar endereço e token na mão</Text>
          </Pressable>
        </View>
      ) : (
        <View className="flex-1 px-4">
          <Text className="font-sans text-[12.5px] leading-[18px] text-ink2">
            Os mesmos dados que aparecem embaixo do QR no painel.
          </Text>

          <Text className="mt-4 font-semibold text-[10px] tracking-[1.4px] text-ink3">ENDEREÇO DO PC</Text>
          <TextInput
            value={host}
            onChangeText={setHost}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            placeholder="192.168.0.14"
            placeholderTextColor={palette.faint}
            className="mt-1.5 rounded border-[1.5px] border-line bg-field px-3.5 py-3 font-sans text-[15px] text-ink"
          />

          <Text className="mt-3.5 font-semibold text-[10px] tracking-[1.4px] text-ink3">TOKEN</Text>
          <TextInput
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            placeholder="cole o token aqui"
            placeholderTextColor={palette.faint}
            className="mt-1.5 h-20 rounded border-[1.5px] border-line bg-field px-3.5 py-3 font-sans text-[13px] text-ink"
          />

          <Pressable
            onPress={() => {
              const h = host.trim();
              const t = token.trim();
              if (!h || !t) {
                setErro("preencha endereço e token");
                return;
              }
              void concluir({ host: h, port: 4000, token: t });
            }}
            className="mt-4 items-center rounded bg-accent py-3.5 active:scale-[0.99]"
          >
            <Text className="font-display text-[15px] tracking-[1.4px] text-white">PAREAR</Text>
          </Pressable>

          {erro && <Text className="mt-2.5 text-center font-sans text-[12px] text-danger">{erro}</Text>}

          <Pressable onPress={() => setManual(false)} className="items-center py-4">
            <Text className="font-sans text-[12.5px] text-faint">voltar para a câmera</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
