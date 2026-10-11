import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { DatePickerModal, en, registerTranslation } from "react-native-paper-dates";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../api/client";
import { AdminEmpty, AdminHero, AdminSearch, AdminStat, FilterChips, useAdminContentWidth } from "../components/admin/AdminUI";
import { rs } from "../components/admin/SalesTrendCard";
import { CardListSkeleton } from "../components/Skeleton";
import { useOrderHistory } from "../hooks/useOrder";
import { orderItemName, PAYMENT_METHOD_LABEL, toDateParam, toNumber } from "../lib/pos";
import { useDashboardPalette } from "../theme/dashboardPalette";
import type { HistoryOrder } from "../types/pos";

registerTranslation("en", en);

type Status = "pending" | "completed" | "cancelled";
type StatusFilter = "all" | Status;
type DatePreset = "all" | "today" | "week" | "custom";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_LABEL: Record<Status, string> = { pending: "Pending", completed: "Completed", cancelled: "Cancelled" };

/** Preparing / ready count as "pending" (still open), like the web. */
const statusOf = (o: HistoryOrder): Status =>
  o.status === "completed" ? "completed" : o.status === "cancelled" ? "cancelled" : "pending";

function presetRange(preset: DatePreset): { startDate?: string; endDate?: string } {
  const today = new Date();
  if (preset === "today") return { startDate: toDateParam(today), endDate: toDateParam(today) };
  if (preset === "week") {
    const weekAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    return { startDate: toDateParam(weekAgo), endDate: toDateParam(today) };
  }
  return {};
}

/** "2026-10-08" → "08/10/2026" */
const showDate = (param: string) => param.split("-").reverse().join("/");

/** "Oct 11, 2026 · 2:30 PM" */
const orderTime = (iso: string) => {
  const date = new Date(iso);
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
};

/** "Cash", "Cash + QR", "Unpaid". */
const paymentLabel = (o: HistoryOrder) => {
  const methods = [...new Set(o.payments.map((p) => p.method))];
  return methods.length ? methods.map((m) => PAYMENT_METHOD_LABEL[m] ?? m).join(" + ") : "Unpaid";
};

/**
 * Manager "Orders", like the web: totals, search, status filter and every order
 * (tap to see items and the bill). Extra on mobile: Today / 7 days / custom dates.
 * The server returns the newest 50 orders for the chosen period.
 */
export default function ManagerOrdersScreen() {
  const d = useDashboardPalette();
  const insets = useSafeAreaInsets();
  const contentWidth = useAdminContentWidth();

  const [preset, setPreset] = useState<DatePreset>("all");
  const [customRange, setCustomRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  const range = preset === "custom" ? customRange : presetRange(preset);
  const history = useOrderHistory(range);
  const orders = useMemo(() => history.data ?? [], [history.data]);

  const stats = useMemo(() => {
    const completed = orders.filter((o) => statusOf(o) === "completed");
    return {
      total: orders.length,
      revenue: completed.reduce((sum, o) => sum + toNumber(o.total), 0),
      completed: completed.length,
      pending: orders.filter((o) => statusOf(o) === "pending").length,
      cancelled: orders.filter((o) => statusOf(o) === "cancelled").length,
    };
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "all" && statusOf(o) !== status) return false;
      if (!q) return true;
      return (
        String(o.orderNumber).includes(q) ||
        o.orderType.replace("_", " ").includes(q) ||
        paymentLabel(o).toLowerCase().includes(q) ||
        (o.customerName ?? "").toLowerCase().includes(q) ||
        (o.table?.tableNumber ?? "").toLowerCase().includes(q) ||
        o.items.some((i) => orderItemName(i).toLowerCase().includes(q))
      );
    });
  }, [orders, search, status]);

  // 5 cards: one row on a tablet, 3 + 2 in landscape, 2 per row on a phone.
  const statBasis = contentWidth >= 900 ? "18%" : contentWidth >= 560 ? "30%" : "45%";

  const refresh = async () => {
    setPulling(true);
    await history.refetch();
    setPulling(false);
  };

  const header = (
    <View style={{ gap: 20, marginBottom: 12 }}>
      <AdminHero
        title="Orders"
        subtitle={
          preset === "custom" && customRange.startDate
            ? `${showDate(customRange.startDate)} – ${showDate(customRange.endDate ?? customRange.startDate)}`
            : "Newest 50 orders of the period"
        }
      >
        <FilterChips<DatePreset>
          options={[
            { value: "all", label: "Recent" },
            { value: "today", label: "Today" },
            { value: "week", label: "Last 7 Days" },
            { value: "custom", label: "Pick dates", icon: "calendar-range" },
          ]}
          value={preset}
          onChange={(p) => (p === "custom" ? setPickerOpen(true) : setPreset(p))}
        />
      </AdminHero>

      {history.isLoading ? null : (
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          <AdminStat basis={statBasis} tone="slate" icon="shopping-outline" label="Total Orders" value={String(stats.total)} />
          <AdminStat basis={statBasis} tone="emerald" icon="trending-up" label="Revenue" value={rs(stats.revenue)} />
          <AdminStat basis={statBasis} tone="emerald" icon="check-circle-outline" label="Completed" value={String(stats.completed)} />
          <AdminStat basis={statBasis} tone="amber" icon="clock-outline" label="In Progress" value={String(stats.pending)} />
          <AdminStat basis={statBasis} tone="red" icon="close-circle-outline" label="Cancelled" value={String(stats.cancelled)} />
        </View>
      )}

      <View className={contentWidth >= 760 ? "flex-row items-center justify-between gap-4" : "gap-3"}>
        <View style={contentWidth >= 760 ? { flex: 1, maxWidth: 420 } : undefined}>
          <AdminSearch value={search} onChangeText={setSearch} placeholder="Search order #, type, item, customer..." />
        </View>
        <FilterChips<StatusFilter> options={STATUS_FILTERS} value={status} onChange={setStatus} />
      </View>
    </View>
  );

  return (
    <View className="flex-1">
      <FlatList
        data={history.isLoading ? [] : filtered}
        keyExtractor={(o) => o.id}
        ListHeaderComponent={header}
        contentContainerStyle={{
          gap: 10,
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
          width: "100%",
          maxWidth: 1100,
          alignSelf: "center",
        }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}
        renderItem={({ item }) => (
          <OrderRow order={item} expanded={expanded === item.id} onToggle={() => setExpanded(expanded === item.id ? null : item.id)} />
        )}
        ListEmptyComponent={
          history.isLoading ? (
            <CardListSkeleton cards={4} />
          ) : history.error ? (
            <AdminEmpty icon="alert-circle-outline" text={getErrorMessage(history.error, "Failed to load orders. Please try again.")} error />
          ) : (
            <AdminEmpty
              icon="receipt"
              text={orders.length === 0 ? "No orders recorded in this period." : "No orders match your search."}
            />
          )
        }
      />

      <DatePickerModal
        locale="en"
        mode="range"
        visible={pickerOpen}
        onDismiss={() => setPickerOpen(false)}
        startDate={customRange.startDate ? new Date(`${customRange.startDate}T00:00:00`) : undefined}
        endDate={customRange.endDate ? new Date(`${customRange.endDate}T00:00:00`) : undefined}
        validRange={{ endDate: new Date() }}
        onConfirm={({ startDate, endDate }) => {
          setPickerOpen(false);
          if (!startDate) return;
          setCustomRange({ startDate: toDateParam(startDate), endDate: toDateParam(endDate ?? startDate) });
          setPreset("custom");
        }}
      />
    </View>
  );
}

/** One order: number, type, status, items, payment, date, total. Tap to show items and the bill. */
function OrderRow({ order, expanded, onToggle }: { order: HistoryOrder; expanded: boolean; onToggle: () => void }) {
  const d = useDashboardPalette();
  const s = statusOf(order);
  const st = d.status[s];
  const dineIn = order.orderType === "dine_in";
  const subtotal = toNumber(order.subtotal);
  const tax = toNumber(order.taxAmount ?? order.tax);
  const taxRate = toNumber(order.taxRate) || (subtotal > 0 ? (tax / subtotal) * 100 : 0);

  return (
    <View className="overflow-hidden rounded-xl" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="gap-2.5 p-4"
        style={({ pressed }) => ({ backgroundColor: pressed ? d.pressed : "transparent" })}
      >
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-1 flex-row items-center gap-2">
            <Text style={{ color: d.link, fontSize: 14, fontWeight: "800", fontFamily: "monospace" }}>#{order.orderNumber}</Text>
            <View className="flex-1 flex-row items-center gap-1.5">
              <MaterialCommunityIcons name={dineIn ? "seat-outline" : "silverware-fork-knife"} size={14} color={d.muted} />
              <Text numberOfLines={1} style={{ flex: 1, color: d.sub, fontSize: 13 }}>
                {dineIn
                  ? `Dine In${order.table?.tableNumber ? ` · ${order.table.tableNumber}` : ""}`
                  : `Takeaway${order.customerName ? ` · ${order.customerName}` : ""}`}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: st.bg }}>
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: st.dot }} />
            <Text style={{ color: st.text, fontSize: 11, fontWeight: "700" }}>{STATUS_LABEL[s]}</Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
            <Text style={{ color: d.muted, fontSize: 12 }}>
              {order.items.length} item{order.items.length !== 1 ? "s" : ""}
            </Text>
            <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: d.skeleton, borderWidth: 1, borderColor: d.border }}>
              <Text style={{ color: d.sub, fontSize: 11, fontFamily: "monospace" }}>{paymentLabel(order)}</Text>
            </View>
            <Text style={{ color: d.muted, fontSize: 12 }}>{orderTime(order.createdAt)}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Text style={{ color: d.text, fontSize: 15, fontWeight: "700" }}>{rs(toNumber(order.total))}</Text>
            <MaterialCommunityIcons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={d.muted} />
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <View className="gap-4 p-4" style={{ backgroundColor: d.rowExpanded, borderTopWidth: 1, borderColor: d.border }}>
          <View>
            <Text style={{ color: d.muted, fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 6 }}>ORDER ITEMS</Text>
            {order.items.map((item) => (
              <View
                key={item.id}
                className="flex-row items-center justify-between gap-3 py-2"
                style={{ borderBottomWidth: 1, borderColor: d.border }}
              >
                <View className="flex-1 flex-row items-center gap-3">
                  <View className="h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: d.qty.bg }}>
                    <Text style={{ color: d.qty.text, fontSize: 10, fontWeight: "700" }}>{item.quantity}</Text>
                  </View>
                  <Text numberOfLines={2} style={{ flex: 1, color: d.title, fontSize: 13, fontWeight: "500" }}>
                    {orderItemName(item)}
                  </Text>
                </View>
                <Text style={{ color: d.sub, fontSize: 12, fontFamily: "monospace" }}>{rs(toNumber(item.subtotal))}</Text>
              </View>
            ))}
          </View>

          <View className="gap-1.5">
            <Text style={{ color: d.muted, fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 2 }}>SUMMARY</Text>
            <SummaryRow label="Subtotal" value={`Rs. ${subtotal.toFixed(2)}`} />
            <SummaryRow label={`Tax (${Number(taxRate.toFixed(2))}%)`} value={`Rs. ${tax.toFixed(2)}`} />
            <View style={{ borderTopWidth: 1, borderColor: d.border, marginTop: 4, paddingTop: 6 }}>
              <SummaryRow label="Total" value={`Rs. ${toNumber(order.total).toFixed(2)}`} bold />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const d = useDashboardPalette();
  return (
    <View className="flex-row justify-between">
      <Text style={{ color: bold ? d.text : d.sub, fontSize: 13, fontWeight: bold ? "700" : "400" }}>{label}</Text>
      <Text style={{ color: bold ? d.link : d.sub, fontSize: 13, fontWeight: bold ? "700" : "400", fontFamily: "monospace" }}>{value}</Text>
    </View>
  );
}