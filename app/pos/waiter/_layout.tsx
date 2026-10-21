import { Stack } from "expo-router";

import { useFoodReadyAlert } from "../../../src/systems/pos/hooks/useFoodReadyAlert";
import { useStackScreenOptions } from "../../../src/shared/navigation/useStackScreenOptions";

export default function WaiterLayout() {
  const screenOptions = useStackScreenOptions();
  useFoodReadyAlert("dine_in");

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="tables" options={{ title: "Dine-In" }} />
      <Stack.Screen name="table/[id]" options={{ title: "Table" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="history" options={{ title: "History" }} />
    </Stack>
  );
}
