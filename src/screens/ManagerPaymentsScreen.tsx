import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMemo, useState, type ComponentProps } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { DatePickerModal, en, registerTranslation } from "react-native-paper-dates";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../api/client";
import { AdminEmpty, AdminHero, AdminSearch, AdminStat, FilterChips, useAdminContentWidth } from "../components/admin/AdminUI";
import { rs } from "../components/admin/SalesTrendCard";
import { ListSkeleton } from "../components/Skeleton";
import { usePaymentLedger } from "../hooks/useAdmin";
import { PAYMENT_METHOD_LABEL, PLATFORM_METHODS, toDateParam } from "../lib/pos";
import { useDashboardPalette } from "../theme/dashboardPalette";
import type { LedgerPayment } from "../types/admin";
import type { PaymentMethod } from "../types/pos";

registerTranslation("en", en);

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type MethodFilter = "all" | PaymentMethod;

const METHOD_ICON: Record<PaymentMethod, IconName> = {
  cash: "cash",
  card: "credit-card-outline",
  qr: "qrcode",
  yango: "moped-outline",
  foodmandu: "moped-outline",
  pathao: "moped-outline",
};

const METHOD_FILTERS: { value: MethodFilter; label: string; icon?: IconName }[] = [
  { value: "all", label: "All Methods" },
  ...(["cash", "card", "qr", "yango", "foodmandu", "pathao"] as const).map((m) => ({
    value: m,
    label: PAYMENT_METHOD_LABEL[m],
    icon: METHOD_ICON[m],
  })),
];

/** "2026-10-08" → "08/10/2026" */
const showDate = (param: string) => param.split("-").reverse().join("/");

/** "Dine In · Table 5" / "Takeaway" (same wording as the web). */
const placeLabel = (p: LedgerPayment) =>
  p.orderType === "dine_in"
    ? `Dine In${p.tableNumber ? ` · ${p.tableNumber.toLowerCase().includes("table") ? p.tableNumber : `Table ${p.tableNumber}`}` : ""}`
    : "Takeaway";

/**
 * Manager "Payment Ledger", like the web: revenue and number of payments, search,
 * filter by day and method, and every payment of the outlet.
 */
export default function ManagerPaymentsScreen() {
  const d = useDashboardPalette();
  const insets = useSafeAreaInsets();
  const contentWidth = useAdminContentWidth();

  const [date, setDate] = useState<string | undefined>();
  const [method, setMethod] = useState<MethodFilter>("all");
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pulling, setPulling] = useState(false);

  const ledger = usePaymentLedger({ date, method: method === "all" ? undefined : method });
  const payments = useMemo(() => ledger.data ?? [], [ledger.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter(
      (p) =>
        String(p.orderNumber).includes(q) ||
        (p.tableNumber ?? "").toLowerCase().includes(q) ||
        p.orderType.replace("_", " ").includes(q) ||
        String(p.amount).includes(q),
    );
  }, [payments, search]);

  const revenue = filtered.reduce((sum, p) => sum + p.amount, 0);
  const searching = !!search.trim();
  const hasFilters = !!(date || method !== "all" || searching);
  const statBasis = contentWidth >= 520 ? "45%" : "100%";

  const subtitle = hasFilters
    ? `Showing filtered results${method !== "all" ? ` · ${PAYMENT_METHOD_LABEL[method]} only` : ""}${date ? ` · ${showDate(date)}` : ""}`
    : "Every payment received at this outlet";

  const clearFilters = () => {
    setDate(undefined);
    setMethod("all");
    setSearch("");
  };

  const refresh = async () => {
    setPulling(true);
    await ledger.refetch();
    setPulling(false);
  };

  const header = (
    <View style={{ gap: 20, marginBottom: 12 }}>
      <AdminHero title="Payment Ledger" subtitle={subtitle} />

      {ledger.isLoading ? null : (
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          <AdminStat
            basis={statBasis}
            tone="emerald"
            icon="check-circle-outline"
            label={searching ? "Search Results Revenue" : hasFilters ? "Filtered Revenue" : "Net Revenue"}
            value={rs(revenue)}
          />
          <AdminStat
            basis={statBasis}
            tone="slate"
            icon="trending-up"
            label={searching ? "Search Transactions" : hasFilters ? "Filtered Transactions" : "Transactions"}
            value={String(filtered.length)}
          />
        </View>
      )}

      <View className="gap-3">
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <AdminSearch value={search} onChangeText={setSearch} placeholder="Search by Order No. or Table" />
          </View>
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Filter by date"
            className="flex-row items-center gap-1.5 rounded-lg px-3 py-2.5 active:opacity-70"
            style={{
              backgroundColor: date ? d.chip.activeBg : d.input.bg,
              borderWidth: 1,
              borderColor: date ? d.chip.activeBg : d.input.border,
            }}
          >
            <MaterialCommunityIcons name="calendar" size={16} color={date ? d.chip.activeText : d.input.placeholder} />
            <Text style={{ color: date ? d.chip.activeText : d.input.text, fontSize: 13 }}>{date ? showDate(date) : "Date"}</Text>
          </Pressable>
        </View>

        <FilterChips<MethodFilter> options={METHOD_FILTERS} value={method} onChange={setMethod} />

        {hasFilters ? (
          <Pressable
            onPress={clearFilters}
            accessibilityRole="button"
            className="flex-row items-center gap-1.5 self-start rounded-lg px-3 py-2 active:opacity-70"
            style={{ backgroundColor: d.error.bg }}
          >
            <MaterialCommunityIcons name="close" size={14} color={d.error.text} />
            <Text style={{ color: d.error.text, fontSize: 12, fontWeight: "600" }}>Clear Filters</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={{ color: d.title, fontSize: 14, fontWeight: "600" }}>Transaction Log</Text>
    </View>
  );

  return (
    <View className="flex-1">
      <FlatList
        data={ledger.isLoading ? [] : filtered}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        contentContainerStyle={{
          gap: 8,
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
          width: "100%",
          maxWidth: 900,
          alignSelf: "center",
        }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}
        renderItem={({ item }) => <PaymentRow payment={item} />}
        ListEmptyComponent={
          ledger.isLoading ? (
            <ListSkeleton rows={6} thumbnail={false} />
          ) : ledger.error ? (
            <AdminEmpty icon="alert-circle-outline" text={getErrorMessage(ledger.error, "Failed to load payments.")} error />
          ) : (
            <AdminEmpty icon="credit-card-outline" text="No payments match criteria." />
          )
        }
      />

      <DatePickerModal
        locale="en"
        mode="single"
        visible={pickerOpen}
        onDismiss={() => setPickerOpen(false)}
        date={date ? new Date(`${date}T00:00:00`) : undefined}
        validRange={{ endDate: new Date() }}
        onConfirm={({ date: picked }) => {
          setPickerOpen(false);
          setDate(picked ? toDateParam(picked) : undefined);
        }}
      />
    </View>
  );
}

/** One payment: order number, Nepal time, table / takeaway, method, amount. */
function PaymentRow({ payment }: { payment: LedgerPayment }) {
  const d = useDashboardPalette();
  const m = PLATFORM_METHODS.includes(payment.method) ? d.method.platform : (d.method[payment.method as "cash" | "card" | "qr"] ?? d.method.cash);
  const dineIn = payment.orderType === "dine_in";

  return (
    <View
      className="flex-row items-center justify-between gap-3 rounded-xl px-4 py-3"
      style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}
    >
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text style={{ color: d.link, fontSize: 13, fontWeight: "800", fontFamily: "monospace" }}>#{payment.orderNumber}</Text>
          <MaterialCommunityIcons name={dineIn ? "seat-outline" : "silverware-fork-knife"} size={13} color={d.muted} />
          <Text numberOfLines={1} style={{ flex: 1, color: d.sub, fontSize: 13 }}>
            {placeLabel(payment)}
          </Text>
        </View>
        <Text style={{ color: d.muted, fontSize: 11 }}>{payment.createdAtNepal.slice(0, 16)}</Text>
      </View>

      <View className="items-end gap-1">
        <Text style={{ color: d.text, fontSize: 14, fontWeight: "700" }}>{rs(payment.amount)}</Text>
        <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: m.bg }}>
          <MaterialCommunityIcons name={METHOD_ICON[payment.method] ?? "cash"} size={12} color={m.text} />
          <Text style={{ color: m.text, fontSize: 11, fontWeight: "700" }}>{PAYMENT_METHOD_LABEL[payment.method] ?? payment.method}</Text>
        </View>
      </View>
    </View>
  );
}