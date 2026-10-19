import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useRef, useState, type ComponentProps } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Button } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../../shared/api/client";
import SalesTrendCard, { rs } from "../components/admin/SalesTrendCard";
import { useManagerDashboard, useSalesTrend } from "../hooks/useAdmin";
import { useLayout } from "../../../shared/hooks/useLayout";
import { useDashboardPalette, type DashboardPalette } from "../../../shared/theme/dashboardPalette";
import type { LowStockAlert, TopProduct, TrendPeriod } from "../types/admin";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const PERIODS: { value: TrendPeriod; label: string }[] = [
  { value: "hourly", label: "24H" },
  { value: "weekly", label: "7D" },
  { value: "monthly", label: "30D" },
];

/** Width of the fixed menu on wide screens (AdminShell). */
const SIDEBAR_WIDTH = 256;

/** "1.50" → "1.5". */
const qty = (n: number) => String(Number(n.toFixed(3)));

const openInventory = () => {
  if (router.canDismiss()) router.dismissAll();
  router.replace("/pos/manager/inventory" as never);
};

/**
 * Manager "Dashboard Overview", like the web: revenue, staff, orders, sales trend
 * (24H / 7D / 30D), popular items and low-stock alerts. Pull down to refresh.
 */
export default function ManagerDashboardScreen() {
  const d = useDashboardPalette();
  const insets = useSafeAreaInsets();
  const { width, isWide } = useLayout();

  const [period, setPeriod] = useState<TrendPeriod>("hourly");
  const [showBanner, setShowBanner] = useState(true);
  const [pulling, setPulling] = useState(false);

  const dashboard = useManagerDashboard();
  const trend = useSalesTrend(period);

  const scrollRef = useRef<ScrollView>(null);
  const alertsY = useRef(0);

  // Room next to the menu decides the layout.
  const contentWidth = width - (isWide ? SIDEBAR_WIDTH : 0);
  const statsInRow = contentWidth >= 520;
  const twoColumns = contentWidth >= 840;

  const data = dashboard.data;
  const salesTrend = trend.data ?? [];
  const lowStock = [...(data?.lowstock ?? [])].sort((a, b) => Number(b.isOutOfStock) - Number(a.isOutOfStock));
  const outCount = lowStock.filter((i) => i.isOutOfStock).length;
  const lowCount = lowStock.length - outCount;
  const totalOrders = salesTrend.reduce((sum, t) => sum + t.count, 0);
  const loading = dashboard.isLoading;
  const error = dashboard.error ?? trend.error;

  const refresh = async () => {
    setPulling(true);
    await Promise.all([dashboard.refetch(), trend.refetch()]);
    setPulling(false);
  };

  const stats = (
    <View className={statsInRow ? "flex-row gap-4" : "gap-4"}>
      <StatCard d={d} inRow={statsInRow} tone="emerald" icon="trending-up" label="Total Revenue" value={loading ? null : rs(data?.totalRevenue ?? 0)} />
      <StatCard d={d} inRow={statsInRow} tone="blue" icon="account-group-outline" label="Active Staff" value={loading ? null : String(data?.activeStaff ?? 0)} />
      <StatCard d={d} inRow={statsInRow} tone="amber" icon="shopping-outline" label="Total Orders" value={loading || trend.isLoading ? null : String(totalOrders)} />
    </View>
  );

  const trendCard = (
    <SalesTrendCard
      trend={salesTrend}
      period={period}
      loading={trend.isLoading}
      refreshing={(dashboard.isRefetching || trend.isFetching) && !pulling && !trend.isLoading}
      onRefresh={() => {
        dashboard.refetch();
        trend.refetch();
      }}
    />
  );

  const popular = <PopularItems d={d} loading={loading} items={data?.topProducts ?? []} />;

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{
        gap: 24,
        paddingTop: 16,
        paddingBottom: insets.bottom + 32,
        paddingLeft: (isWide ? 0 : insets.left) + 16,
        paddingRight: insets.right + 16,
        width: "100%",
        maxWidth: 1280,
        alignSelf: "center",
      }}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}
    >
      {/* Header */}
      <View
        className={`gap-4 rounded-xl px-6 py-5 ${statsInRow ? "flex-row items-center justify-between" : ""}`}
        style={{ backgroundColor: d.hero.bg, elevation: 1 }}
      >
        <View className={statsInRow ? "flex-1" : undefined}>
          <Text style={{ color: d.hero.text, fontSize: 22, fontWeight: "600" }}>Dashboard Overview</Text>
          <Text style={{ color: d.hero.sub, fontSize: 13, marginTop: 4 }}>
            Welcome back! Here is a summary of your outlet&apos;s performance.
          </Text>
        </View>
        <View
          className="flex-row items-center gap-1 self-start rounded-xl p-1"
          style={{ backgroundColor: d.hero.toggleBg, borderWidth: 1, borderColor: d.hero.toggleBorder }}
        >
          {PERIODS.map((p) => {
            const active = p.value === period;
            return (
              <Pressable
                key={p.value}
                onPress={() => setPeriod(p.value)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                className="rounded-lg px-4 py-1.5"
                style={{ backgroundColor: active ? d.hero.activeBg : "transparent" }}
              >
                <Text style={{ color: active ? d.hero.activeText : d.hero.idleText, fontSize: 12, fontWeight: "700" }}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error && !loading ? (
        <View className="gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: d.error.bg, borderWidth: 1, borderColor: d.error.border }}>
          <Text style={{ color: d.error.text, fontSize: 13 }}>{getErrorMessage(error, "Failed to load dashboard.")}</Text>
          {!data ? (
            <Button mode="outlined" icon="refresh" compact onPress={refresh} style={{ alignSelf: "flex-start" }}>
              Try again
            </Button>
          ) : null}
        </View>
      ) : null}

      {/* Low-stock banner */}
      {lowStock.length > 0 && showBanner ? (
        <StockBanner
          d={d}
          outCount={outCount}
          lowCount={lowCount}
          wide={statsInRow}
          onDetails={() => scrollRef.current?.scrollTo({ y: alertsY.current - 16, animated: true })}
          onDismiss={() => setShowBanner(false)}
        />
      ) : null}

      {stats}

      {twoColumns ? (
        <View className="flex-row items-start gap-4">
          <View style={{ flex: 2 }}>{trendCard}</View>
          <View style={{ flex: 1 }}>{popular}</View>
        </View>
      ) : (
        <>
          {trendCard}
          {popular}
        </>
      )}

      <View onLayout={(e) => (alertsY.current = e.nativeEvent.layout.y)}>
        <StockAlerts d={d} loading={loading} items={lowStock} twoColumns={statsInRow} />
      </View>
    </ScrollView>
  );
}

function StatCard({
  d,
  inRow,
  tone,
  icon,
  label,
  value,
}: {
  d: DashboardPalette;
  /** Side by side: share the row (in a column, flex-1 would collapse the card). */
  inRow: boolean;
  tone: "emerald" | "blue" | "amber";
  icon: IconName;
  label: string;
  /** null while loading. */
  value: string | null;
}) {
  const c = d[tone];
  return (
    <View
      className={`flex-row items-center justify-between rounded-xl p-5 ${inRow ? "flex-1" : ""}`}
      style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border, borderLeftWidth: 4, borderLeftColor: c.edge }}
    >
      <View className="flex-1">
        <Text style={{ color: d.muted, fontSize: 11, fontWeight: "500", letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</Text>
        {value === null ? (
          <Text style={{ color: d.muted, fontSize: 18, marginTop: 6, opacity: 0.6 }}>Loading...</Text>
        ) : (
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: d.text, fontSize: 28, fontWeight: "700", marginTop: 4 }}>
            {value}
          </Text>
        )}
      </View>
      <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: c.tile }}>
        <MaterialCommunityIcons name={icon} size={24} color={c.icon} />
      </View>
    </View>
  );
}

function StockBanner({
  d,
  outCount,
  lowCount,
  wide,
  onDetails,
  onDismiss,
}: {
  d: DashboardPalette;
  outCount: number;
  lowCount: number;
  wide: boolean;
  onDetails: () => void;
  onDismiss: () => void;
}) {
  const b = d.banner;
  return (
    <View
      className={`gap-4 rounded-xl p-4 ${wide ? "flex-row items-center justify-between" : ""}`}
      style={{ backgroundColor: b.bg, borderWidth: 1, borderColor: b.border }}
    >
      <View className="flex-1 flex-row items-start gap-3.5 pr-5">
        <View
          className="h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: b.iconBg, borderWidth: 1, borderColor: b.iconBorder }}
        >
          <MaterialCommunityIcons name="alert-outline" size={22} color={b.icon} />
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text style={{ color: b.title, fontSize: 14, fontWeight: "600" }}>Inventory Alerts</Text>
            {outCount > 0 ? <Badge bg={d.out.badgeBg} color={d.out.badgeText} text={`${outCount} Out of Stock`} /> : null}
            {lowCount > 0 ? <Badge bg={d.low.badgeBg} color={d.low.badgeText} text={`${lowCount} Low Stock`} /> : null}
          </View>
          <Text style={{ color: b.text, fontSize: 12, lineHeight: 18 }}>
            Some stock items have dropped below their minimum warning levels. This may prevent recipes from being prepared.
            Restock them to maintain normal operations.
          </Text>
        </View>
      </View>

      <View className={`flex-row items-center gap-2.5 ${wide ? "" : "pl-14"}`}>
        <Pressable
          onPress={onDetails}
          accessibilityRole="button"
          className="rounded-lg px-3.5 py-1.5 active:opacity-70"
          style={{ backgroundColor: b.details.bg, borderWidth: 1, borderColor: b.details.border }}
        >
          <Text style={{ color: b.details.text, fontSize: 12, fontWeight: "700" }}>Details</Text>
        </Pressable>
        <Pressable
          onPress={openInventory}
          accessibilityRole="button"
          className="flex-row items-center gap-1.5 rounded-lg px-3.5 py-1.5 active:opacity-80"
          style={{ backgroundColor: b.restock.bg, elevation: 2 }}
        >
          <Text style={{ color: b.restock.text, fontSize: 12, fontWeight: "700" }}>Restock Items</Text>
          <MaterialCommunityIcons name="arrow-right" size={14} color={b.restock.text} />
        </Pressable>
      </View>

      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss alert"
        hitSlop={8}
        className="absolute right-2 top-2 rounded-lg p-1"
      >
        <MaterialCommunityIcons name="close" size={16} color={d.muted} />
      </Pressable>
    </View>
  );
}

function PopularItems({ d, loading, items }: { d: DashboardPalette; loading: boolean; items: TopProduct[] }) {
  return (
    <View className="gap-4 rounded-xl p-5" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
      <View className="flex-row items-center gap-2">
        <MaterialCommunityIcons name="star-outline" size={16} color={d.star} />
        <Text style={{ color: d.title, fontSize: 14, fontWeight: "600" }}>Popular Menu Items</Text>
      </View>

      {loading ? (
        <View className="gap-2">
          {[1, 2, 3].map((i) => (
            <View key={i} className="h-12 rounded-lg" style={{ backgroundColor: d.skeleton }} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <View className="items-center gap-2 py-6">
          <MaterialCommunityIcons name="star-outline" size={32} color={d.muted} style={{ opacity: 0.4 }} />
          <Text style={{ color: d.muted, fontSize: 12, fontWeight: "500" }}>No sales data yet.</Text>
        </View>
      ) : (
        <View className="gap-1">
          {items.map((p) => (
            <View key={`${p.rank}-${p.name}`} className="flex-row items-center justify-between gap-3 rounded-lg p-2">
              <View className="flex-1 flex-row items-center gap-3">
                <View
                  className="h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: d.rank.bg, borderWidth: 1, borderColor: d.rank.border }}
                >
                  <Text style={{ color: d.rank.text, fontSize: 12, fontWeight: "700" }}>{p.rank}</Text>
                </View>
                <View className="flex-1">
                  <Text numberOfLines={1} style={{ color: d.title, fontSize: 13, fontWeight: "600", textTransform: "capitalize" }}>
                    {p.name}
                  </Text>
                  <Text style={{ color: d.muted, fontSize: 11, marginTop: 2 }}>{p.totalSold} sold</Text>
                </View>
              </View>
              <Text style={{ color: d.revenue, fontSize: 12, fontWeight: "700" }}>{rs(p.totalRevenue)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function StockAlerts({
  d,
  loading,
  items,
  twoColumns,
}: {
  d: DashboardPalette;
  loading: boolean;
  items: LowStockAlert[];
  twoColumns: boolean;
}) {
  return (
    <View className="gap-4 rounded-xl p-5" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          <MaterialCommunityIcons name="alert-outline" size={16} color={d.star} />
          <Text style={{ color: d.title, fontSize: 14, fontWeight: "600" }}>Alerts & Warnings</Text>
        </View>
        {items.length > 0 ? (
          <Text style={{ color: d.muted, fontSize: 12, fontWeight: "500" }}>
            Total {items.length} warning{items.length > 1 ? "s" : ""} active
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View className="gap-2 py-2">
          {[1, 2].map((i) => (
            <View key={i} className="h-14 rounded-lg" style={{ backgroundColor: d.skeleton }} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <Text style={{ color: d.muted, fontSize: 12, textAlign: "center", paddingVertical: 24 }}>
          All systems normal. Stock levels are healthy.
        </Text>
      ) : (
        <View className={twoColumns ? "flex-row flex-wrap" : undefined} style={{ gap: 14 }}>
          {items.map((item) => {
            const c = item.isOutOfStock ? d.out : d.low;
            return (
              <Pressable
                key={item.id}
                onPress={openInventory}
                accessibilityRole="button"
                accessibilityHint="Opens inventory"
                className="flex-row items-center justify-between gap-2 rounded-xl p-3.5 active:opacity-70"
                style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, flexGrow: 1, flexBasis: twoColumns ? "45%" : "100%" }}
              >
                <View className="flex-1 flex-row items-center gap-3">
                  <View className="h-2 w-2 rounded-full" style={{ backgroundColor: c.dot }} />
                  <View className="flex-1">
                    <Text numberOfLines={1} style={{ color: d.title, fontSize: 13, fontWeight: "600", textTransform: "capitalize" }}>
                      {item.name}
                    </Text>
                    <Text style={{ color: d.sub, fontSize: 11, marginTop: 4 }}>
                      Current:{" "}
                      <Text style={{ color: c.value, fontWeight: "700" }}>
                        {qty(item.currentStock)} {item.unit}
                      </Text>
                      {" • "}Min Limit:{" "}
                      <Text style={{ color: d.title, fontWeight: "600" }}>
                        {qty(item.minStockLevel)} {item.unit}
                      </Text>
                    </Text>
                  </View>
                </View>
                <Badge bg={c.badgeBg} color={c.badgeText} text={item.isOutOfStock ? "OUT OF STOCK" : "LOW STOCK"} pill />
                <MaterialCommunityIcons name="chevron-right" size={18} color={d.muted} />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function Badge({ bg, color, text, pill }: { bg: string; color: string; text: string; pill?: boolean }) {
  return (
    <View className={pill ? "rounded-full px-2 py-0.5" : "rounded px-1.5 py-0.5"} style={{ backgroundColor: bg }}>
      <Text style={{ color, fontSize: 10, fontWeight: "700", letterSpacing: pill ? 0.4 : 0 }}>{text}</Text>
    </View>
  );
}