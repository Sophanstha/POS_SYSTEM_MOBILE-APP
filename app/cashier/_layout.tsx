import { Stack } from "expo-router";

import { useStackScreenOptions } from "../../src/navigation/useStackScreenOptions";

export default function CashierLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="takeaway" options={{ title: "Takeaway" }} />
      <Stack.Screen name="tables" options={{ title: "Dine-In" }} />
      <Stack.Screen name="table/[id]" options={{ title: "Table" }} />
      <Stack.Screen name="history" options={{ title: "History" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}
