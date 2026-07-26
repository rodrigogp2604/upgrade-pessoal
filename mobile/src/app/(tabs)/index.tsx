import { ScrollView, Text, View } from "react-native";
import { useGame } from "@/game/useGame";
import { useAppTheme } from "@/theme/useAppTheme";
import { AvatarInitials, ProgressBar, SectionLabel, XpRing } from "@/components/ui";
import { MissionMain, MissionSide, type Estado } from "@/components/MissionItem";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function periodoDoArco(inicioISO: string): string {
  const ini = new Date(`${inicioISO}T12:00:00`);
  const fim = new Date(ini);
  fim.setDate(fim.getDate() + 6);
  const mesmoMes = ini.getMonth() === fim.getMonth();
  return mesmoMes
    ? `${ini.getDate()} a ${fim.getDate()} de ${MESES[fim.getMonth()]}`
    : `${ini.getDate()} de ${MESES[ini.getMonth()]} a ${fim.getDate()} de ${MESES[fim.getMonth()]}`;
}

export default function MissoesScreen() {
  const { palette } = useAppTheme();
  const {
    data, level, floor, title, power, xpInto, xpPct,
    activeWeek, mainMissions, sideMissions, completeMission, attachmentsOf,
  } = useGame();

  const feitas = mainMissions.filter((m) => m.status === "done").length;
  const primeiraPendente = mainMissions.find((m) => m.status === "pending");

  const estadoDe = (id: number, status: string): Estado =>
    status === "done" ? "done" : id === primeiraPendente?.id ? "active" : "locked";

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-4 pb-6" showsVerticalScrollIndicator={false}>
      {/* herói compacto */}
      <View className="flex-row items-center gap-3.5 rounded-md border border-panelLine bg-panel px-4 py-3.5">
        <XpRing size={62} pct={xpPct} trackColor="rgba(255,255,255,.16)">
          <AvatarInitials name={data.character.name} size={62} />
        </XpRing>

        <View className="min-w-0 flex-1">
          <View className="flex-row items-baseline gap-2">
            <Text className="font-display text-[20px] tracking-[1.6px] text-panelInk">{data.character.name}</Text>
            <Text className="font-display text-[13px] tracking-[1px] text-accent">NV. {level}</Text>
          </View>
          <Text className="font-sans text-[11.5px] text-panelMute">
            {title ?? "sem título ainda"} · Poder {power}
          </Text>
          <View className="mt-2">
            <ProgressBar pct={xpPct} height={5} track="bg-white/15" />
          </View>
          <Text className="mt-[3px] font-sans text-[10.5px] text-panelFaint">
            XP {xpInto}/100 para o nível {level + 1}
          </Text>
        </View>
      </View>

      {/* andar */}
      <View className="mt-3.5 rounded-md border border-line bg-surf px-3.5 py-3.5">
        <View className="flex-row items-baseline justify-between">
          <Text className="font-display text-[21px] tracking-[1.5px] text-ink">ANDAR {floor}</Text>
          <Text className="font-displaySemi text-[13px] tracking-[1px] text-accentInk">
            {feitas}/{mainMissions.length} MISSÕES
          </Text>
        </View>
        <Text className="mt-[2px] font-sans text-[12px] text-ink2">
          {activeWeek ? `${activeWeek.theme} — ${periodoDoArco(activeWeek.startDate)}` : "nenhum arco aberto"}
        </Text>
        <View className="mt-2.5">
          <ProgressBar pct={mainMissions.length ? (feitas / mainMissions.length) * 100 : 0} />
        </View>
      </View>

      {/* aviso de domingo: quem fecha o arco é o cowork, no PC */}
      {activeWeek && diasDesde(activeWeek.startDate) >= 7 && (
        <View className="mt-3 rounded-md border border-accent/40 bg-amberSoft px-3.5 py-3">
          <Text className="font-sans text-[12px] leading-[18px] text-ink2">
            <Text className="font-semibold text-accentInk">Domingo chegou.</Text> Feche este arco no PC,
            junto com o cowork — é lá que as estrelas e o próximo andar são definidos.
          </Text>
        </View>
      )}

      <SectionLabel className="mb-2 mt-[18px]">MISSÕES PRINCIPAIS · LINEARES</SectionLabel>
      <View className="gap-2">
        {mainMissions.map((m) => (
          <MissionMain
            key={m.id}
            mission={m}
            estado={estadoDe(m.id, m.status)}
            provas={attachmentsOf(m.id)}
            onComplete={() => completeMission(m.id)}
            onProof={() => {
              /* câmera/galeria entram na Fase 8 */
            }}
          />
        ))}
      </View>

      {sideMissions.length > 0 && (
        <>
          <View className="mb-2 mt-5 flex-row items-center gap-2">
            <SectionLabel>SECUNDÁRIAS</SectionLabel>
            <View className="rounded-full bg-accent px-2 py-[2px]">
              <Text className="font-sans text-[10px] tracking-[1px] text-white">XP BÔNUS</Text>
            </View>
          </View>
          <View className="gap-[7px]">
            {sideMissions.map((m) => (
              <MissionSide key={m.id} mission={m} onComplete={() => completeMission(m.id)} />
            ))}
          </View>
        </>
      )}

      {mainMissions.length === 0 && (
        <View className="mt-4 rounded-md border border-line bg-surf px-4 py-5">
          <Text className="text-center font-sans text-[12.5px] leading-[19px]" style={{ color: palette.ink2 }}>
            Nenhuma missão neste aparelho ainda. Sincronize com o PC para receber o arco da semana.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function diasDesde(iso: string): number {
  const ini = new Date(`${iso}T12:00:00`).getTime();
  return Math.floor((Date.now() - ini) / 86400000);
}
