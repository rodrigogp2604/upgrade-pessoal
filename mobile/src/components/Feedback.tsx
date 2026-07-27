// Os três efeitos do protótipo: XP subindo, toast e a tela de nível novo.
// Animated do próprio React Native — sem worklet, sem risco de configuração.
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import Svg, { Polygon } from "react-native-svg";
import { ACCENT } from "@/theme/palette";

export function XpFloat({ amount, onDone }: { amount: number; onDone: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(
      onDone
    );
  }, [anim, onDone]);

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute left-0 right-0 items-center"
      style={{
        top: "38%",
        opacity: anim.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 1, 0] }),
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, -52] }) },
          { scale: anim.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0.8, 1.15, 1] }) },
        ],
      }}
    >
      <Text className="font-display text-[38px]" style={{ color: ACCENT }}>
        +{amount} XP
      </Text>
    </Animated.View>
  );
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 160 }),
      Animated.delay(2400),
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(onDone);
  }, [anim, onDone]);

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute bottom-4 left-4 right-4 flex-row items-center gap-2.5 rounded-md bg-toast px-4 py-3"
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }],
      }}
    >
      <View className="h-2 w-2 bg-accent" style={{ transform: [{ rotate: "45deg" }] }} />
      <Text className="flex-1 font-sans text-[13px] text-panelInk">{message}</Text>
    </Animated.View>
  );
}

export function Celebration({ level, onClose }: { level: number; onClose: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  const giro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 120 }).start();
    Animated.loop(
      Animated.timing(giro, { toValue: 1, duration: 40000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, [anim, giro]);

  return (
    <Pressable onPress={onClose} className="absolute inset-0 items-center justify-center px-7" style={{ backgroundColor: "#0a0a24" }}>
      <Animated.View
        pointerEvents="none"
        className="absolute"
        style={{
          width: 900,
          height: 900,
          opacity: 0.5,
          transform: [{ rotate: giro.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
        }}
      >
        {/* raios: leque de triângulos girando devagar, como no protótipo */}
        <Svg width={900} height={900} viewBox="0 0 900 900">
          {Array.from({ length: 24 }).map((_, i) => (
            <Polygon
              key={i}
              points="450,450 470,0 430,0"
              fill="rgba(242,164,28,0.10)"
              transform={`rotate(${i * 15} 450 450)`}
            />
          ))}
        </Svg>
      </Animated.View>

      <Animated.View className="items-center" style={{ transform: [{ scale: anim }] }}>
        <Text className="font-displaySemi text-[13px] tracking-[4px]" style={{ color: ACCENT }}>
          ANDAR CONQUISTADO
        </Text>
        <Text className="mt-1 font-display text-[86px] leading-[92px] text-white">{level}</Text>
        <Text className="mt-1 text-center font-sans text-[13px] leading-5" style={{ color: "#c9c2ba" }}>
          Você subiu um andar da Torre. Toque para continuar.
        </Text>
      </Animated.View>
    </Pressable>
  );
}
