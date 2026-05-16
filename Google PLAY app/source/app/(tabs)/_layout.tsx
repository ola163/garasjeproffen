import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.orange,
        tabBarInactiveTintColor: Colors.gray400,
        tabBarStyle: { borderTopColor: Colors.gray200, backgroundColor: Colors.white },
        headerStyle: { backgroundColor: Colors.orange },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: "700", fontSize: 17 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Konfigurator",
          tabBarIcon: ({ color, size }) => <Ionicons name="construct-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="referanser"
        options={{
          title: "Referanser",
          tabBarIcon: ({ color, size }) => <Ionicons name="images-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="kontakt"
        options={{
          title: "Kontakt",
          tabBarIcon: ({ color, size }) => <Ionicons name="call-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
