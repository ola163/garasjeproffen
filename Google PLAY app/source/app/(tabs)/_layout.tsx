import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "react-native";
import { Colors } from "@/constants/Colors";

const LogoHeader = () => (
  <Image
    source={require("../../assets/icon.png")}
    style={{ width: 28, height: 28, borderRadius: 6, marginLeft: 4 }}
    resizeMode="contain"
  />
);

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
        headerLeft: () => <LogoHeader />,
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
        name="plasser"
        options={{
          title: "Plasser",
          tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="soknadshjelp"
        options={{
          title: "Søknadshjelp",
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="referanser" options={{ href: null }} />
<Tabs.Screen
        name="kontakt"
        options={{
          title: "Kontakt",
          tabBarIcon: ({ color, size }) => <Ionicons name="call-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="minside"
        options={{
          title: "Min side",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
