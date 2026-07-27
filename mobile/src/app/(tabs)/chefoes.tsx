import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useGame } from "@/game/useGame";
import { useAppTheme } from "@/theme/useAppTheme";
import { BossTabIcon, SwordIcon } from "@/components/icons";
import { ProgressBar, brl } from "@/components/ui";

export default function ChefoesScreen() {
  const { palette } = useAppTheme();
  const { data, payDebt } = useGame();
  const [selecionado, setSelecionado] = useState<number | null>(data.debts.find((d) => d.status === "active")?.id ?? null);
  const [valor, setValor] = useState("");

  const restanteTotal = data.debts.reduce((a, d) => a + Math.max(0, d.total - d.paid), 0);
  const chefao = data.debts.find((d) => d.id === selecionado) ?? null;
  const saudeFinanceira = Math.round(data.character.stats["Saúde Financeira"] ?? 0);

  const atacar = () => {
    const n = Number(valor.replace(",", "."));
    if (!chefao || !n || n <= 0) return;
    void payDebt(chefao.id, n);
    setValor("");
  };

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-4 pb-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View className="mb-3 mt-1 flex-row items-baseline justify-between">
        <Text className="font-display text-[20px] tracking-[2.6px] text-ink">CHEFÕES</Text>
        <Text className="font-sans text-[11.5px] text-ink3">
          restam <Text className="font-semibold text-danger">{brl(restanteTotal)}</Text>
        </Text>
      </View>

      <View className="gap-2">
        {data.debts.map((d) => {
          const restante = Math.max(0, d.total - d.paid);
          const ativo = d.id === selecionado;
          const morto = restante <= 0;
          return (
            <Pressable
              key={d.id}
              onPress={() => setSelecionado(d.id)}
              className={`flex-row items-center gap-2.5 rounded-md px-3 py-3 active:scale-[0.99] ${
                ativo ? "bg-panel" : "border border-line bg-surf"
              }`}
            >
              <BossTabIcon size={17} color={ativo ? palette.panelInk : palette.ink2} />
              <View className="min-w-0 flex-1">
                <Text className={`font-semibold text-[13.5px] ${ativo ? "text-panelInk" : "text-ink"}`}>{d.name}</Text>
                <View className="mt-1.5">
                  <ProgressBar
                    pct={d.total > 0 ? (restante / d.total) * 100 : 0}
                    track={ativo ? "bg-white/20" : "bg-track"}
                    fill="bg-danger"
                  />
                </View>
              </View>
              <View className="flex-none items-end">
                <Text className={`font-display text-[14px] ${ativo ? "text-panelInk" : "text-ink"}`}>
                  {morto ? "0" : brl(restante)}
                </Text>
                <Text className={`font-sans text-[10px] ${ativo ? "text-panelMute" : "text-faint"}`}>HP</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {chefao && (
        <View className="mt-3.5 rounded-md border border-cardLine bg-card p-4">
          <View className="flex-row items-baseline justify-between">
            <Text className="font-semibold text-[14.5px] text-ink">{chefao.name}</Text>
            {chefao.note && <Text className="font-sans text-[11.5px] text-ink3">{chefao.note}</Text>}
          </View>

          <View className="mb-1.5 mt-2.5 flex-row justify-between">
            <Text className="font-sans text-[11.5px] text-ink3">HP restante</Text>
            <Text className="font-semibold text-[13.5px] text-danger">{brl(Math.max(0, chefao.total - chefao.paid))}</Text>
          </View>
          <ProgressBar pct={chefao.total > 0 ? (Math.max(0, chefao.total - chefao.paid) / chefao.total) * 100 : 0} height={8} fill="bg-danger" />
          <Text className="mt-1 font-sans text-[11px] text-faint">
            de {brl(chefao.total)} · {brl(chefao.paid)} de dano causado
          </Text>

          {chefao.paid < chefao.total ? (
            <View className="mt-3.5 gap-2.5">
              <TextInput
                value={valor}
                onChangeText={setValor}
                keyboardType="decimal-pad"
                placeholder="Valor do pagamento (R$)"
                placeholderTextColor={palette.faint}
                className="rounded border-[1.5px] border-line bg-field px-3.5 py-3 font-sans text-[15px] text-ink"
              />
              <Pressable
                onPress={atacar}
                className="flex-row items-center justify-center gap-2 rounded py-3.5 active:scale-[0.98]"
                style={{ backgroundColor: palette.danger }}
              >
                <SwordIcon />
                <Text className="font-display text-[16px] tracking-[1.6px] text-white">ATACAR</Text>
              </Pressable>
            </View>
          ) : (
            <View className="mt-3 rounded bg-panel py-3">
              <Text className="text-center font-display text-[14px] tracking-[2px] text-accent">☠ CHEFÃO DERROTADO</Text>
            </View>
          )}

          <Text className="mt-2.5 font-sans text-[11px] leading-[16px] text-faint">
            Cada ataque sobe sua <Text className="font-semibold text-accentInk">Saúde Financeira</Text> — hoje em{" "}
            {saudeFinanceira}/100.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
