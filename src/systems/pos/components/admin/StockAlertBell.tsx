import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, usePathname } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useThemeMode } from "../../../../shared/context/ThemeContext";
import { useNewIds } from "../../../../shared/hooks/useNewIds";
import { haptics } from "../../../../shared/lib/haptics";
import { useAdminPalette } from "../../../../shared/theme/adminPalette";
import { usePosAuth } from "../../auth/PosAuthProvider";
import { useStockAlerts } from "../../hooks/useAdmin";
import { useOutletId } from "../../hooks/outletScope";

/** 🔔 in the Manager / Owner header: how many ingredients are low or out. Tap = Inventory. */
export default function StockAlertBell({ inventoryHref }: { inventoryHref: string }) {
  const p = useAdminPalette();
  const { isDark } = useThemeMode();
  const { hasPermission } = usePosAuth();
  const pathname = usePathname();
  const alerts = useStockAlerts();

  if (!hasPermission("inventory.stock.read")) return null;

  const count = alerts.data?.length ?? 0;
  const anyOut = alerts.data?.some((a:any) => a.isOutOfStock) ?? false;

  const open = () => {
    if (pathname === inventoryHref) return;
    if (router.canDismiss()) router.dismissAll();
    router.replace(inventoryHref as never);
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={count ? `${count} stock alert${count === 1 ? "" : "s"}, open inventory` : "No stock alerts"}
      hitSlop={8}
      className="ml-2 rounded-lg p-1.5"
      style={({ pressed }) => ({ backgroundColor: pressed ? p.item.pressed : "transparent" })}
    >
      <MaterialCommunityIcons name={count ? "bell-alert-outline" : "bell-outline"} size={22} color={isDark ? p.brand : p.item.text} />
      {count ? (
        <View
          className="absolute items-center justify-center rounded-full px-1"
          style={{ top: -2, right: -4, minWidth: 18, height: 18, backgroundColor: anyOut ? "#ef4444" : "#f59e0b", pointerEvents: "none" }}
        >
          <Text style={{ color: "#ffffff", fontSize: 10, fontWeight: "800" }}>{count > 99 ? "99+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Manager / Owner layout: a short buzz when an ingredient newly drops to low or out of stock. */
export function useLowStockBuzz() {
  const outletId = useOutletId();
  const alerts = useStockAlerts();

  useNewIds(alerts.data?.map((a:any) => a.id), outletId ?? "", () => haptics.warning());
}