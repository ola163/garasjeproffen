import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/context/AuthContext";
import { ConfigProvider } from "@/context/ConfigContext";

export default function RootLayout() {
  return (
    <AuthProvider>
    <ConfigProvider>
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="tilbud"
          options={{
            title: "Be om tilbud",
            presentation: "modal",
            headerStyle: { backgroundColor: "#f97316" },
            headerTintColor: "#fff",
            headerTitleStyle: { fontWeight: "700" },
          }}
        />
        <Stack.Screen
          name="login"
          options={{
            title: "Logg inn",
            presentation: "modal",
            headerStyle: { backgroundColor: "#f97316" },
            headerTintColor: "#fff",
            headerTitleStyle: { fontWeight: "700" },
          }}
        />
      </Stack>
    </ConfigProvider>
    </AuthProvider>
  );
}
