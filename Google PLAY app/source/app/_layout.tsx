import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
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
      </Stack>
    </>
  );
}
