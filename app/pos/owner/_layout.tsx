import { Stack } from "expo-router";

import AdminShell, { MenuButton } from "../../../src/systems/pos/components/admin/AdminShell";
import StockAlertBell, { useLowStockBuzz } from "../../../src/systems/pos/components/admin/StockAlertBell";
import { OutletGate, OutletSwitcher } from "../../../src/systems/pos/components/admin/OutletSwitcher";
import { usePosAuth } from "../../../src/systems/pos/auth/PosAuthProvider";
import { OWNER_NAV } from "../../../src/systems/pos/navigation/adminNav";
import { useStackScreenOptions } from "../../../src/shared/navigation/useStackScreenOptions";

/** Main sections: opened from the menu, with the ☰ button (phones) instead of a back arrow, and the stock 🔔. */
const section = (title: string) => ({
  title,
  animation: "fade" as const,
  headerLeft: () => <MenuButton />,
  headerRight: () => <StockAlertBell inventoryHref="/pos/owner/inventory" />,
});

/**
 * Owner area: the Manager pages, working on the outlet picked in the menu.
 * An Owner with several outlets first chooses one (the server doesn't pick it at login).
 */
export default function OwnerLayout() {
  const screenOptions = useStackScreenOptions();
  useLowStockBuzz();
  const { activeOutletId } = usePosAuth();

  if (!activeOutletId) return <OutletGate />;

  return (
    <AdminShell items={OWNER_NAV} header={<OutletSwitcher />}>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={section("Overview")} />
        <Stack.Screen name="analytics" options={section("Analytics")} />
        <Stack.Screen name="staff" options={section("Manage Staff")} />
        <Stack.Screen name="outlets" options={section("Outlets")} />
        <Stack.Screen name="tables" options={section("Tables")} />
        <Stack.Screen name="orders" options={section("Orders")} />
        <Stack.Screen name="menu" options={section("Menu")} />
        <Stack.Screen name="payments" options={section("Payments")} />
        <Stack.Screen name="inventory" options={section("Inventory")} />
        <Stack.Screen name="expenses" options={section("Expenses")} />
        <Stack.Screen name="recipes" options={section("Recipes")} />
        <Stack.Screen name="roles" options={section("Roles")} />
        <Stack.Screen name="settings" options={section("Settings")} />
      </Stack>
    </AdminShell>
  );
}
