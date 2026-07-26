import { Pressable, Text, View } from "react-native";
import { CheckIcon, ClipIcon, LockIcon, PlusIcon, ZapIcon } from "./icons";
import { useAppTheme } from "@/theme/useAppTheme";
import type { Mission } from "@/game/types";

// As missões principais são LINEARES: a próxima pendente é a ativa (card grande),
// as depois dela ficam trancadas. É o que empurra uma coisa por vez.
export type Estado = "done" | "active" | "locked";

export function MissionMain({
  mission,
  estado,
  provas,
  onComplete,
  onProof,
}: {
  mission: Mission;
  estado: Estado;
  provas: number;
  onComplete: () => void;
  onProof: () => void;
}) {
  const { palette } = useAppTheme();

  if (estado === "done") {
    return (
      <View className="flex-row items-center gap-3 rounded-md bg-surf2 px-3 py-2.5">
        <View className="h-6 w-6 items-center justify-center rounded-full bg-accent">
          <CheckIcon />
        </View>
        <Text className="flex-1 font-sans text-[13px] text-faint line-through">{mission.title}</Text>
        <Text className="font-displaySemi text-[12.5px] text-faint2">+{mission.xp}</Text>
      </View>
    );
  }

  if (estado === "locked") {
    return (
      <View className="flex-row items-center gap-3 px-3 py-2.5 opacity-55">
        <View className="h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-faint2">
          <LockIcon color={palette.faint} />
        </View>
        <Text className="flex-1 font-sans text-[13px] leading-[17px] text-ink3">{mission.title}</Text>
        <Text className="font-displaySemi text-[12.5px] text-faint2">+{mission.xp}</Text>
      </View>
    );
  }

  return (
    <View className="overflow-hidden rounded-md border border-cardLine bg-card">
      <View className="h-[3px] bg-accent" />
      <View className="px-4 pb-3.5 pt-3">
        <View className="flex-row items-center">
          <Text className="font-display text-[11px] tracking-[2.4px] text-accent">MISSÃO ATIVA</Text>
          <View className="flex-1" />
          <Text className="font-display text-[15px] text-accent">+{mission.xp} XP</Text>
        </View>

        <Text className="mt-1.5 font-semibold text-[16px] leading-[21px] text-ink">{mission.title}</Text>
        {mission.description && (
          <Text className="mt-1.5 font-sans text-[12.5px] leading-[18px] text-ink2">{mission.description}</Text>
        )}
        {mission.bonus && (
          <View className="mt-1.5 flex-row gap-1.5">
            <View className="mt-[3px]">
              <ZapIcon />
            </View>
            <Text className="flex-1 font-sans text-[12px] leading-[17px] text-accentInk">{mission.bonus}</Text>
          </View>
        )}

        <Pressable
          onPress={onComplete}
          className="mt-3 flex-row items-center justify-center gap-2 rounded bg-accent py-3.5 active:scale-[0.98]"
        >
          <CheckIcon size={16} />
          <Text className="font-display text-[16px] tracking-[1.6px] text-white">CONCLUIR</Text>
        </Pressable>

        <Pressable
          onPress={onProof}
          className="mt-2 flex-row items-center justify-center gap-2 rounded border-[1.5px] border-line py-3 active:border-accent"
        >
          <ClipIcon color={palette.ink2} />
          <Text className="font-sans text-[13px] text-ink2">
            {provas === 0 ? "Anexar prova" : `${provas} prova${provas > 1 ? "s" : ""} anexada${provas > 1 ? "s" : ""}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function MissionSide({
  mission,
  onComplete,
}: {
  mission: Mission;
  onComplete: () => void;
}) {
  const feita = mission.status === "done";

  return (
    <View className="flex-row items-center gap-3 rounded-md bg-surf2 px-3 py-2.5">
      {feita ? (
        <>
          <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-accent">
            <CheckIcon size={11} />
          </View>
          <Text className="flex-1 font-sans text-[12.5px] text-faint line-through">{mission.title}</Text>
          <Text className="font-displaySemi text-[12px] text-faint2">+{mission.xp}</Text>
        </>
      ) : (
        <>
          <View className="h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-accent">
            <PlusIcon />
          </View>
          <Text className="flex-1 font-sans text-[12.5px] leading-[17px] text-ink">{mission.title}</Text>
          <Pressable
            onPress={onComplete}
            className="flex-none rounded-[3px] border-[1.5px] border-accent px-3 py-1.5 active:bg-accent"
          >
            <Text className="font-display text-[12px] tracking-[1px] text-accentInk">+{mission.xp}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
