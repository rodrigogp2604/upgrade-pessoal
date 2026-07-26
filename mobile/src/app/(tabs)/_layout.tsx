import { Tabs } from "expo-router";
import { View } from "react-native";
import { Header } from "@/components/Header";
import { TabBar } from "@/components/TabBar";
import { Celebration, Toast, XpFloat } from "@/components/Feedback";
import { useGame } from "@/game/useGame";

// Abas em JS (e não a barra nativa) porque o protótipo pede controle total de cor,
// peso e espaçamento da barra inferior.
export default function TabsLayout() {
  const { feedback, clearFeedback } = useGame();

  return (
    <View className="flex-1">
      <Header />

      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, animation: "shift", sceneStyle: { backgroundColor: "transparent" } }}
      >
        <Tabs.Screen name="index" options={{ title: "Missões" }} />
        <Tabs.Screen name="status" options={{ title: "Status" }} />
        <Tabs.Screen name="torre" options={{ title: "Torre" }} />
        <Tabs.Screen name="chefoes" options={{ title: "Chefões" }} />
        <Tabs.Screen name="renda" options={{ title: "Renda" }} />
      </Tabs>

      {feedback.xp != null && <XpFloat amount={feedback.xp} onDone={clearFeedback} />}
      {feedback.toast && <Toast message={feedback.toast} onDone={clearFeedback} />}
      {feedback.levelUp != null && <Celebration level={feedback.levelUp} onClose={clearFeedback} />}
    </View>
  );
}
