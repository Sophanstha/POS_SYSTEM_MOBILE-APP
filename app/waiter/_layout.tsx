import { Stack } from "expo-router";

import { useStackScreenOptions } from "../../src/navigation/useStackScreenOptions";

export default function WaiterLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="tables" options={{ title: "Dine-In" }} />
      <Stack.Screen name="history" options={{ title: "History" }} />
    </Stack>
  );
}