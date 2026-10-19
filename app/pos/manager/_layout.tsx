import { Stack } from "expo-router";

import AdminShell, { MenuButton } from "../../../src/systems/pos/components/admin/AdminShell";
import { MANAGER_NAV } from "../../../src/systems/pos/navigation/adminNav";
import { useStackScreenOptions } from "../../../src/shared/navigation/useStackScreenOptions";

/** Main sections: opened from the menu, with the ☰ button (phones) instead of a back arrow. */
const section = (title: string) => ({ title, animation: "fade" as const, headerLeft: () => <MenuButton /> });

export default function ManagerLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <AdminShell items={MANAGER_NAV}>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={section("Overview")} />
        <Stack.Screen name="analytics" options={section("Analytics")} />
        <Stack.Screen name="staff" options={section("Manage Staff")} />
        <Stack.Screen name="menu" options={section("Menu")} />
        <Stack.Screen name="tables" options={section("Tables")} />
        <Stack.Screen name="orders" options={section("Orders")} />
        <Stack.Screen name="payments" options={section("Payments")} />
        <Stack.Screen name="inventory" options={section("Inventory")} />
        <Stack.Screen name="expenses" options={section("Expenses")} />
        <Stack.Screen name="recipes" options={section("Recipes")} />
        <Stack.Screen name="settings" options={section("Settings")} />
      </Stack>
    </AdminShell>
  );
}