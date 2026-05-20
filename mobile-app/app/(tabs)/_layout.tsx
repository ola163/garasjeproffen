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
          tabBarLabel: "Konfigurer",
          tabBarIcon: ({ color, size }) => <Ionicons name="construct-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="soknadshjelp"
        options={{
          title: "Søknadshjelp",
          tabBarLabel: "Søknad",
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="kontakt"
        options={{
          title: "Kontakt",
          tabBarLabel: "Kontakt",
          tabBarIcon: ({ color, size }) => <Ionicons name="call-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="minside"
        options={{
          title: "Min side",
          tabBarLabel: "Min side",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      {/* Hidden screens — kept in router but not shown in tab bar */}
      <Tabs.Screen name="plasser" options={{ href: null }} />
      <Tabs.Screen name="referanser" options={{ href: null }} />
    </Tabs>
  );
}
