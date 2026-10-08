import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { ActivityIndicator, Button, Card, Chip, Divider, Searchbar, Text } from "react-native-paper";
import { DatePickerModal, en, registerTranslation } from "react-native-paper-dates";

import { getErrorMessage } from "../api/client";
import StatusPill from "../components/StatusPill";
import { useOrderHistory } from "../hooks/useOrder";
import { formatRs, orderItemName, PAYMENT_METHOD_LABEL, roundMoney, toDateParam, toNumber } from "../lib/pos";
import { useAppTheme } from "../theme/paperTheme";
import { orderStatusColor } from "../theme/statusColors";
import type { HistoryOrder } from "../types/pos";

registerTranslation("en", en);

type DatePreset = "today" | "week" | "all" | "custom";
type StatusFilter = "all" | "completed" | "pending" | "cancelled";

const DATE_PRESETS: { value: Exclude<DatePreset, "custom">; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 Days" },
  { value: "all", label: "All Time" },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_LABEL: Record<HistoryOrder["status"], string> = {
  pending: "Pending",
  preparing: "Pending",
  ready: "Pending",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Not completed and not cancelled = still open (the web calls it "Pending"). */
const isPending = (o: HistoryOrder) => o.status !== "completed" && o.status !== "cancelled";

function presetRange(preset: DatePreset): { startDate?: string; endDate?: string } {
  const today = new Date();
  if (preset === "today") return { startDate: toDateParam(today), endDate: toDateParam(today) };
  if (preset === "week") {
    const weekAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6); // 7 days incl. today
    return { startDate: toDateParam(weekAgo), endDate: toDateParam(today) };
  }
  return {};
}

/** "2026-10-08" → "08/10/2026" */
const displayDate = (param?: string) => (param ? param.split("-").reverse().join("/") : "dd/mm/yyyy");

/** Past orders of the outlet, like the web Order History (newest 50 per range — server limit). */
export default function HistoryScreen() {
  const theme = useAppTheme();

  const [preset, setPreset] = useState<DatePreset>("all");
  const [customRange, setCustomRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const range = useMemo(() => (preset === "custom" ? customRange : presetRange(preset)), [preset, customRange]);
  const history = useOrderHistory(range);
  const orders = history.data ?? [];

  // Stats use every order in the date range (same as the web), not the search/status filter.
  const stats = useMemo(() => {
    const completed = orders.filter((o) => o.status === "completed");
    return {
      total: orders.length,
      revenue: roundMoney(completed.reduce((sum, o) => sum + toNumber(o.total), 0)),
      completed: completed.length,
      pending: orders.filter(isPending).length,
    };
  }, [orders]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesStatus =
        status === "all" || (status === "pending" ? isPending(o) : o.status === status);
      const matchesSearch =
        !q ||
        String(o.orderNumber).includes(q) ||
        o.items.some((i) => orderItemName(i).toLowerCase().includes(q) || (i.notes ?? "").toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [orders, search, status]);

  const filtersActive = status !== "all" || search.trim() !== "";

  const header = (
    <View className="gap-3 pb-3 pt-1">
      <View className="flex-row gap-3">
        <StatCard label="Total orders" value={String(stats.total)} color={theme.colors.onSurface} />
        <StatCard label="Revenue" value={formatRs(stats.revenue)} color={theme.colors.primary} />
      </View>
      <View className="flex-row gap-3">
        <StatCard label="Completed" value={String(stats.completed)} color={theme.colors.success} />
        <StatCard label="Pending" value={String(stats.pending)} color={theme.colors.warning} />
      </View>

      <Searchbar
        placeholder="Search order #, item, or notes…"
        value={search}
        onChangeText={setSearch}
        style={{ backgroundColor: theme.colors.surfaceVariant }}
        inputStyle={{ minHeight: 0 }}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {STATUS_FILTERS.map((s) => (
          <Chip
            key={s.value}
            selected={status === s.value}
            showSelectedCheck={false}
            mode={status === s.value ? "flat" : "outlined"}
            onPress={() => setStatus(s.value)}
          >
            {s.label}
          </Chip>
        ))}
      </ScrollView>

      <View className="flex-row flex-wrap items-center gap-2">
        <MaterialCommunityIcons name="calendar-outline" size={18} color={theme.colors.onSurfaceVariant} />
        <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant, marginRight: 4 }}>
          DATE
        </Text>
        {DATE_PRESETS.map((p) => (
          <Chip
            key={p.value}
            compact
            selected={preset === p.value}
            showSelectedCheck={false}
            mode={preset === p.value ? "flat" : "outlined"}
            onPress={() => setPreset(p.value)}
          >
            {p.label}
          </Chip>
        ))}
      </View>

      <View className="flex-row items-center gap-2">
        <DateField value={preset === "custom" ? customRange.startDate : undefined} onPress={() => setPickerOpen(true)} />
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          to
        </Text>
        <DateField value={preset === "custom" ? customRange.endDate : undefined} onPress={() => setPickerOpen(true)} />
        {preset === "custom" ? (
          <Button compact icon="close" onPress={() => setPreset("all")}>
            Clear
          </Button>
        ) : null}
      </View>

      {history.data ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Showing {visible.length} of {orders.length} order{orders.length === 1 ? "" : "s"}
          {orders.length >= 50 ? " · latest 50 only (pick a shorter date range to see older ones)" : ""}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={history.isLoading ? [] : visible}
        keyExtractor={(o) => o.id}
        ListHeaderComponent={header}
        contentContainerClassName="gap-3 px-4 pb-8"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching}
            onRefresh={() => history.refetch()}
            tintColor={theme.colors.primary}
          />
        }
        renderItem={({ item }) => (
          <HistoryCard
            order={item}
            expanded={expanded === item.id}
            onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
          />
        )}
        ListEmptyComponent={
          history.isLoading ? (
            <ActivityIndicator style={{ marginTop: 48 }} />
          ) : (
            <Text
              variant="bodyMedium"
              style={{ color: history.error ? theme.colors.error : theme.colors.onSurfaceVariant, textAlign: "center", marginTop: 48 }}
            >
              {history.error
                ? getErrorMessage(history.error)
                : filtersActive && orders.length > 0
                  ? "No orders match your search or filter."
                  : "No orders in this period."}
            </Text>
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

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const theme = useAppTheme();

  return (
    <View
      className="flex-1 gap-1 rounded-2xl px-4 py-3"
      style={{
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
        borderLeftWidth: 3,
        borderLeftColor: theme.colors.primary,
      }}
    >
      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, letterSpacing: 1, fontWeight: "700" }}>
        {label.toUpperCase()}
      </Text>
      <Text variant="headlineSmall" numberOfLines={1} adjustsFontSizeToFit style={{ color, fontWeight: "800" }}>
        {value}
      </Text>
    </View>
  );
}

function DateField({ value, onPress }: { value?: string; onPress: () => void }) {
  const theme = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `Date ${displayDate(value)}` : "Pick a date range"}
      className="flex-1 flex-row items-center justify-between rounded-xl px-3 py-2.5 active:opacity-70"
      style={{ backgroundColor: theme.colors.surfaceVariant, borderWidth: 1, borderColor: theme.colors.outlineVariant }}
    >
      <Text variant="bodyMedium" style={{ color: value ? theme.colors.onSurface : theme.colors.onSurfaceVariant }}>
        {displayDate(value)}
      </Text>
      <MaterialCommunityIcons name="calendar-month-outline" size={18} color={theme.colors.onSurfaceVariant} />
    </Pressable>
  );
}

function HistoryCard({ order, expanded, onToggle }: { order: HistoryOrder; expanded: boolean; onToggle: () => void }) {
  const theme = useAppTheme();
  const created = new Date(order.createdAt);
  const isToday = created.toDateString() === new Date().toDateString();
  const time = created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const when = isToday ? time : `${created.toLocaleDateString()} ${time}`;

  const where =
    order.orderType === "dine_in"
      ? `Table ${order.table?.tableNumber ?? "—"}`
      : `Takeaway${order.customerName ? ` · ${order.customerName}` : ""}`;
  const methods = [...new Set(order.payments.map((p) => PAYMENT_METHOD_LABEL[p.method]))];

  return (
    <Card mode="outlined" style={{ backgroundColor: theme.colors.surface }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded }}>
        <View className="gap-2 p-4">
          <View className="flex-row items-center justify-between">
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: "700" }}>
              #{order.orderNumber}
            </Text>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: "700" }}>
              {formatRs(order.total)}
            </Text>
          </View>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {where} · {when}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <StatusPill label={STATUS_LABEL[order.status]} color={orderStatusColor(theme, order.status)} />
            <StatusPill
              label={methods.length ? methods.join(" + ") : "Unpaid"}
              color={methods.length ? theme.colors.info : theme.colors.onSurfaceVariant}
            />
          </View>

          {expanded ? (
            <View className="gap-2 pt-2">
              <Divider />
              {order.items.map((item) => (
                <View key={item.id} className="gap-0.5">
                  <View className="flex-row justify-between gap-3">
                    <Text variant="bodyMedium" style={{ flex: 1, color: theme.colors.onSurface }}>
                      {item.quantity} × {orderItemName(item)}
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      {formatRs(item.subtotal)}
                    </Text>
                  </View>
                  {item.notes ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, fontStyle: "italic" }}>
                      “{item.notes}”
                    </Text>
                  ) : null}
                </View>
              ))}
              <Divider />
              <Row label="Subtotal" value={formatRs(order.subtotal)} />
              <Row label={`Tax (${toNumber(order.taxRate)}%)`} value={formatRs(order.taxAmount)} />
              <Row label="Total" value={formatRs(order.total)} bold />

              {order.payments.length > 0 ? (
                <>
                  <Divider />
                  <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                    Payments
                  </Text>
                  {order.payments.map((p) => (
                    <Row
                      key={p.id}
                      label={`${PAYMENT_METHOD_LABEL[p.method]} · ${new Date(p.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                      value={formatRs(p.amount)}
                    />
                  ))}
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>
    </Card>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const theme = useAppTheme();
  const color = bold ? theme.colors.onSurface : theme.colors.onSurfaceVariant;

  return (
    <View className="flex-row justify-between">
      <Text variant="bodyMedium" style={{ color, fontWeight: bold ? "700" : undefined }}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={{ color, fontWeight: bold ? "700" : undefined }}>
        {value}
      </Text>
    </View>
  );
}