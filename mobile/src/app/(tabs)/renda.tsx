import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useGame } from "@/game/useGame";
import { useAppTheme } from "@/theme/useAppTheme";
import { ProgressBar, brl } from "@/components/ui";

export default function RendaScreen() {
  const { palette } = useAppTheme();
  const { data, addExtra, setSetting } = useGame();

  const [salario, setSalario] = useState("");
  const [freela, setFreela] = useState("");
  const [freelaValor, setFreelaValor] = useState("");

  const num = (k: string) => Number(data.settings[k] ?? 0);
  const inicio = num("income_start");
  const checkpoint = num("income_checkpoint");
  const alvo = num("income_target");
  const atual = num("income_current");
  const totalMes = atual + data.extras.reduce((a, e) => a + e.value, 0);

  const temMetas = alvo > inicio && inicio > 0;
  const pctMeta = temMetas ? Math.max(2, Math.min(100, ((totalMes - inicio) / (alvo - inicio)) * 100)) : 0;
  const pctCheckpoint = temMetas ? ((checkpoint - inicio) / (alvo - inicio)) * 100 : 50;

  const salvarSalario = () => {
    const n = Number(salario.replace(",", "."));
    if (!n || n <= 0) return;
    void setSetting("income_current", String(n));
    setSalario("");
  };

  const adicionarFreela = () => {
    const n = Number(freelaValor.replace(",", "."));
    if (!freela.trim() || !n || n <= 0) return;
    void addExtra(freela.trim(), n);
    setFreela("");
    setFreelaValor("");
  };

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-4 pb-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text className="mb-3 mt-1 font-display text-[20px] tracking-[2.6px] text-ink">RENDA · COL DO MÊS</Text>

      <View className="flex-row gap-2.5">
        <View className="flex-1 rounded-md border border-cardLine bg-card px-3.5 py-3">
          <Text className="font-semibold text-[10px] tracking-[1.4px] text-ink3">SALÁRIO FIXO</Text>
          <Text className="font-display text-[20px] text-ink">{brl(atual)}</Text>
        </View>
        <View className="flex-1 rounded-md border border-accent/40 bg-amberSoft px-3.5 py-3">
          <Text className="font-semibold text-[10px] tracking-[1.4px] text-accentInk">TOTAL DO MÊS</Text>
          <Text className="font-display text-[20px] text-accentInk">{brl(totalMes)}</Text>
        </View>
      </View>

      {temMetas && (
        <View className="mt-3 rounded-md border border-cardLine bg-card px-4 py-3.5">
          <View className="mb-1.5 flex-row justify-between">
            <Text className="font-semibold text-[10.5px] tracking-[0.5px] text-ink3">MISSÃO PRINCIPAL</Text>
            <Text className="font-sans text-[10.5px] text-ink3">
              {inicio.toLocaleString("pt-BR")} → {checkpoint.toLocaleString("pt-BR")} → {alvo.toLocaleString("pt-BR")}+
            </Text>
          </View>
          <View className="relative">
            <ProgressBar pct={pctMeta} height={9} />
            {/* marca do checkpoint */}
            <View className="absolute top-0 h-[9px] w-[2px] bg-card" style={{ left: `${pctCheckpoint}%` }} />
          </View>
          <Text className="mt-1.5 font-sans text-[11px] text-faint">
            Checkpoint {brl(checkpoint)} · chefe final {brl(alvo)}+
          </Text>
        </View>
      )}

      <View className="mt-3 rounded-md border border-cardLine bg-card px-4 py-3.5">
        <Text className="mb-2.5 font-semibold text-[10.5px] tracking-[1.4px] text-ink3">ATUALIZAR SALÁRIO</Text>
        <View className="flex-row gap-2">
          <TextInput
            value={salario}
            onChangeText={setSalario}
            keyboardType="decimal-pad"
            placeholder="Novo valor (R$)"
            placeholderTextColor={palette.faint}
            className="flex-1 rounded border-[1.5px] border-line bg-field px-3 py-3 font-sans text-[15px] text-ink"
          />
          <Pressable onPress={salvarSalario} className="flex-none justify-center rounded bg-panel px-5 active:bg-accent">
            <Text className="font-display text-[14px] tracking-[1.4px] text-panelInk">OK</Text>
          </Pressable>
        </View>
      </View>

      <View className="mt-3 rounded-md border border-cardLine bg-card px-4 py-3.5">
        <Text className="mb-2.5 font-semibold text-[10.5px] tracking-[1.4px] text-ink3">QUESTS DE RENDA · FREELAS</Text>

        {data.extras.map((e) => (
          <View key={e.id} className="mb-1.5 flex-row items-center justify-between rounded bg-soft px-3 py-2.5">
            <Text className="font-sans text-[12.5px] text-ink">{e.name}</Text>
            <Text className="font-display text-[14px] text-accentInk">+{brl(e.value)}</Text>
          </View>
        ))}

        <TextInput
          value={freela}
          onChangeText={setFreela}
          placeholder="Freela / bico (ex.: site do dentista)"
          placeholderTextColor={palette.faint}
          className="rounded border-[1.5px] border-line bg-field px-3 py-3 font-sans text-[14px] text-ink"
        />
        <View className="mt-2 flex-row gap-2">
          <TextInput
            value={freelaValor}
            onChangeText={setFreelaValor}
            keyboardType="decimal-pad"
            placeholder="R$"
            placeholderTextColor={palette.faint}
            className="flex-1 rounded border-[1.5px] border-line bg-field px-3 py-3 font-sans text-[15px] text-ink"
          />
          <Pressable
            onPress={adicionarFreela}
            className="flex-none justify-center rounded border-[1.5px] border-accent px-4 active:bg-accent"
          >
            <Text className="font-display text-[14px] tracking-[1.2px] text-accentInk">ADICIONAR</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
