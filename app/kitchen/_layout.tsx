import { Stack } from "expo-router";

import { useStackScreenOptions } from "../../src/navigation/useStackScreenOptions";

export default function KitchenLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}