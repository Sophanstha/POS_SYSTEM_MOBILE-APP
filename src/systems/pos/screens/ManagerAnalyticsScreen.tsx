import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Modal, Portal } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../../shared/api/client";
import { AdminEmpty, AdminHero, AdminStat, FilterChips, useAdminContentWidth } from "../../../shared/components/AdminUI";
import { rs } from "../components/admin/SalesTrendCard";
import { usePosAuth } from "../auth/PosAuthProvider";
import { useProfitReport } from "../hooks/useAdmin";
import { useDashboardPalette } from "../../../shared/theme/dashboardPalette";
import type { ProfitRange, ProfitTotals } from "../types/admin";

type ViewMode = "monthly" | "yearly" | "overall";

/** One period of the chart / breakdown, totals already added up. */
type Row = ProfitTotals & { key: string; label: string; totalExpense: number };

/** Same colours as the web chart: revenue green, expense rose, net profit sky. */
const COLORS = { revenue: "#10b981", expense: "#f43f5e", profit: "#0ea5e9" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CHART_HEIGHT = 200;
const GROUP_MIN_WIDTH = 58;
const BAR_WIDTH = 12;
const Y_AXIS_WIDTH = 40;

/** "2026-10" → "Oct 26" (web: month short + 2-digit year). */
const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return y && m ? `${MONTHS[m - 1]} ${String(y).slice(2)}` : month;
};

/** "2026-10" → "Oct 2026". */
const monthLong = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return y && m ? `${MONTHS[m - 1]} ${y}` : month;
};

/** Y-axis amounts: "850", "6.1k", "-1.2k", "1.2M". */
function compact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${Number((abs / 1_000_000).toFixed(1))}M`;
  if (abs >= 1_000) return `${sign}${Number((abs / 1_000).toFixed(1))}k`;
  return `${sign}${Math.round(abs)}`;
}

const toRow = (key: string, label: string, t: ProfitTotals): Row => ({
  ...t,
  key,
  label,
  totalExpense: Number((t.purchaseExpense + t.wastageExpense + t.manualExpense).toFixed(2)),
});

/**
 * Manager "Profit & Expense Report", like the web Analytics page: Monthly / Yearly / Overall,
 * a month range, revenue / expense / net profit totals, a chart and a breakdown per period.
 */
export default function ManagerAnalyticsScreen() {
  const d = useDashboardPalette();
  const insets = useSafeAreaInsets();
  const contentWidth = useAdminContentWidth();
  const { role, activeOutlet } = usePosAuth();
  const isOwner = role === "Owner";
  // Owner: this outlet, or every outlet added up.
  const [scope, setScope] = useState<"outlet" | "all">("outlet");

  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [range, setRange] = useState<ProfitRange>({});
  const [picking, setPicking] = useState<"startMonth" | "endMonth" | null>(null);
  const [pulling, setPulling] = useState(false);

  const report = useProfitReport(range, isOwner && scope === "all");
  const data = report.data;

  // Chart: oldest → newest. Breakdown: newest first (like the web table).
  const chartRows = useMemo<Row[]>(() => {
    if (!data) return [];
    if (viewMode === "overall") return [toRow("overall", "Overall", data.overall)];
    if (viewMode === "yearly") return data.years.map((y) => toRow(y.year, y.year, y));
    return data.months.map((m) => toRow(m.month, monthLabel(m.month), m));
  }, [data, viewMode]);

  const breakdown = useMemo<Row[]>(() => {
    if (!data) return [];
    if (viewMode === "overall") return [toRow("overall", "Overall All-Time", data.overall)];
    if (viewMode === "yearly") return [...data.years].reverse().map((y) => toRow(y.year, y.year, y));
    return [...data.months].reverse().map((m) => toRow(m.month, monthLong(m.month), m));
  }, [data, viewMode]);

  const overall = data ? toRow("overall", "Overall", data.overall) : null;
  const profitUp = (overall?.netProfit ?? 0) >= 0;
  const statBasis = contentWidth >= 560 ? "30%" : "100%";
  const hasRange = !!(range.startMonth || range.endMonth);

  /** Keeps "from" ≤ "to": picking a later start moves the end with it, and the other way round. */
  const pickMonth = (field: "startMonth" | "endMonth", month: string | undefined) => {
    setRange((r) => {
      const next = { ...r, [field]: month };
      if (next.startMonth && next.endMonth && next.startMonth > next.endMonth) {
        if (field === "startMonth") next.endMonth = month;
        else next.startMonth = month;
      }
      return next;
    });
    setPicking(null);
  };

  const refresh = async () => {
    setPulling(true);
    await report.refetch();
    setPulling(false);
  };

  const header = (
    <View style={{ gap: 20, marginBottom: 12 }}>
      <AdminHero title="Profit & Expense Report" subtitle={hasRange ? rangeText(range) : "All time"}>
        <FilterChips<ViewMode>
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly" },
            { value: "overall", label: "Overall Business" },
          ]}
          value={viewMode}
          onChange={setViewMode}
        />
      </AdminHero>

      {isOwner ? (
        <FilterChips<"outlet" | "all">
          options={[
            { value: "outlet", label: activeOutlet?.name ?? "This outlet", icon: "storefront-outline" },
            { value: "all", label: "All outlets", icon: "domain" },
          ]}
          value={scope}
          onChange={setScope}
        />
      ) : null}

      {report.error ? <AdminEmpty icon="alert-circle-outline" text={getErrorMessage(report.error, "Failed to load report.")} error /> : null}

      {/* Month range */}
      <View className="gap-2 rounded-xl p-4" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
        <View className="flex-row items-center gap-2">
          <MaterialCommunityIcons name="calendar-range" size={16} color={d.muted} />
          <Text style={{ flex: 1, color: d.title, fontSize: 13, fontWeight: "600" }}>Date Range</Text>
          {hasRange ? (
            <Pressable onPress={() => setRange({})} accessibilityRole="button" hitSlop={8} className="active:opacity-60">
              <Text style={{ color: d.link, fontSize: 12, fontWeight: "600" }}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        <View className="flex-row items-center gap-2">
          <MonthBox label="From" value={range.startMonth} onPress={() => setPicking("startMonth")} />
          <Text style={{ color: d.muted }}>–</Text>
          <MonthBox label="To" value={range.endMonth} onPress={() => setPicking("endMonth")} />
        </View>
      </View>

      {/* Totals */}
      {overall ? (
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          <AdminStat basis={statBasis} tone="emerald" icon="wallet-outline" label="Revenue" value={rs(overall.revenue)} />
          <AdminStat basis={statBasis} tone="red" icon="receipt" label="Total Expense" value={rs(overall.totalExpense)} />
          <AdminStat
            basis={statBasis}
            tone={profitUp ? "blue" : "red"}
            icon={profitUp ? "trending-up" : "trending-down"}
            label="Net Profit"
            value={rs(overall.netProfit)}
          />
        </View>
      ) : null}
      {overall ? (
        <Text style={{ color: d.muted, fontSize: 11, marginTop: -12 }}>Total expense = restocks + wastage + manual expenses.</Text>
      ) : null}

      {/* Chart */}
      <View className="gap-4 rounded-xl p-5" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 flex-row flex-wrap items-center gap-2">
            <View className="h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: d.brand.tile }}>
              <MaterialCommunityIcons name="chart-bar" size={15} color={d.brand.icon} />
            </View>
            <Text style={{ color: d.title, fontSize: 14, fontWeight: "600" }}>Revenue vs Expense</Text>
            <Text style={{ color: d.muted, fontSize: 12 }}>
              — {viewMode === "monthly" ? "By month" : viewMode === "yearly" ? "By year" : "All time"}
            </Text>
          </View>
          <Pressable
            onPress={() => report.refetch()}
            disabled={report.isFetching}
            accessibilityRole="button"
            hitSlop={8}
            className="flex-row items-center gap-1.5 active:opacity-60"
          >
            {report.isFetching && !report.isLoading ? (
              <ActivityIndicator size={14} color={d.muted} />
            ) : (
              <MaterialCommunityIcons name="refresh" size={15} color={d.muted} />
            )}
            <Text style={{ color: d.muted, fontSize: 12 }}>Refresh</Text>
          </Pressable>
        </View>

        {report.isLoading ? (
          <View className="flex-row items-end gap-2 px-1" style={{ height: CHART_HEIGHT }}>
            {[45, 65, 40, 80, 55, 70, 50].map((h, i) => (
              <View key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%`, backgroundColor: d.skeleton }} />
            ))}
          </View>
        ) : chartRows.length === 0 ? (
          <View className="items-center justify-center gap-2" style={{ height: CHART_HEIGHT }}>
            <MaterialCommunityIcons name="chart-bar" size={32} color={d.muted} style={{ opacity: 0.4 }} />
            <Text style={{ color: d.muted, fontSize: 12, fontWeight: "500" }}>No data for this range.</Text>
          </View>
        ) : (
          <ProfitChart rows={chartRows} />
        )}
      </View>

      <View className="flex-row items-center justify-between">
        <Text style={{ color: d.title, fontSize: 14, fontWeight: "600" }}>Breakdown</Text>
        {breakdown.length > 0 && viewMode !== "overall" ? (
          <Text style={{ color: d.muted, fontSize: 12 }}>
            {breakdown.length} {viewMode === "monthly" ? "months" : "years"}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View className="flex-1">
      <FlatList
        data={report.isLoading ? [] : breakdown}
        keyExtractor={(r) => r.key}
        ListHeaderComponent={header}
        contentContainerStyle={{
          gap: 10,
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
          width: "100%",
          maxWidth: 1000,
          alignSelf: "center",
        }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}
        renderItem={({ item }) => <BreakdownRow row={item} />}
        ListEmptyComponent={
          report.isLoading ? null : report.error ? null : <AdminEmpty icon="chart-box-outline" text="No data for this range." />
        }
      />

      <MonthPickerDialog
        visible={!!picking}
        title={picking === "endMonth" ? "To month" : "From month"}
        value={picking ? range[picking] : undefined}
        onDismiss={() => setPicking(null)}
        onPick={(month) => picking && pickMonth(picking, month)}
      />
    </View>
  );
}

/** "Jan 2026 – Oct 2026", "From Jan 2026", "Until Oct 2026". */
function rangeText(range: ProfitRange): string {
  if (range.startMonth && range.endMonth) {
    return range.startMonth === range.endMonth ? monthLong(range.startMonth) : `${monthLong(range.startMonth)} – ${monthLong(range.endMonth)}`;
  }
  if (range.startMonth) return `From ${monthLong(range.startMonth)}`;
  return `Until ${monthLong(range.endMonth!)}`;
}

/** Box showing a picked month (or "Any"); tap to change. */
function MonthBox({ label, value, onPress }: { label: string; value?: string; onPress: () => void }) {
  const d = useDashboardPalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ? monthLong(value) : "any month"}`}
      className="flex-1 flex-row items-center gap-2 rounded-lg px-3 py-2.5 active:opacity-70"
      style={{ backgroundColor: value ? d.brand.tile : d.input.bg, borderWidth: 1, borderColor: value ? d.brand.edge : d.input.border }}
    >
      <Text style={{ color: d.muted, fontSize: 11, fontWeight: "600" }}>{label.toUpperCase()}</Text>
      <Text numberOfLines={1} style={{ flex: 1, color: value ? d.link : d.input.placeholder, fontSize: 13, fontWeight: value ? "700" : "400" }}>
        {value ? monthLong(value) : "Any"}
      </Text>
      <MaterialCommunityIcons name="calendar-month-outline" size={16} color={value ? d.link : d.input.placeholder} />
    </Pressable>
  );
}

/**
 * Grouped bars per period (revenue, expense, net profit), with a zero line so a loss
 * shows below it. Scrolls sideways when there are many months; tap a period for its numbers.
 */
function ProfitChart({ rows }: { rows: Row[] }) {
  const d = useDashboardPalette();
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(rows.length - 1);

  // New data → show the latest period.
  useEffect(() => setSelected(rows.length - 1), [rows]);

  const top = Math.max(1, ...rows.map((r) => Math.max(r.revenue, r.totalExpense, r.netProfit)));
  const bottom = Math.min(0, ...rows.map((r) => r.netProfit));
  const span = top - bottom;
  const zeroY = (top / span) * CHART_HEIGHT; // distance from the top to the zero line
  const barHeight = (v: number) => (Math.abs(v) / span) * CHART_HEIGHT;

  const plotWidth = Math.max(width - Y_AXIS_WIDTH, 0);
  const groupWidth = Math.max(GROUP_MIN_WIDTH, rows.length ? plotWidth / rows.length : 0);
  const point = rows[selected] ?? rows[rows.length - 1];

  const series = [
    { key: "revenue", label: "Revenue", color: COLORS.revenue, value: (r: Row) => r.revenue },
    { key: "expense", label: "Expense", color: COLORS.expense, value: (r: Row) => r.totalExpense },
    { key: "profit", label: "Net Profit", color: COLORS.profit, value: (r: Row) => r.netProfit },
  ];

  return (
    <View className="gap-3">
      <View className="flex-row" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {/* Y axis: top, zero, bottom */}
        <View style={{ width: Y_AXIS_WIDTH, height: CHART_HEIGHT + 20 }}>
          <Text style={{ position: "absolute", top: -6, color: d.muted, fontSize: 10 }}>{compact(top)}</Text>
          <Text style={{ position: "absolute", top: zeroY - 6, color: d.muted, fontSize: 10 }}>0</Text>
          {bottom < 0 ? <Text style={{ position: "absolute", top: CHART_HEIGHT - 6, color: d.muted, fontSize: 10 }}>{compact(bottom)}</Text> : null}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          <View style={{ height: CHART_HEIGHT + 20, width: Math.max(groupWidth * rows.length, plotWidth) }}>
            {/* Grid: top line and the zero line */}
            <View style={{ position: "absolute", left: 0, right: 0, top: 0, borderTopWidth: 1, borderStyle: "dashed", borderColor: d.border }} />
            <View style={{ position: "absolute", left: 0, right: 0, top: zeroY, borderTopWidth: 1, borderColor: d.muted, opacity: 0.6 }} />

            <View className="flex-row" style={{ height: CHART_HEIGHT + 20 }}>
              {rows.map((r, i) => {
                const active = i === selected;
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => setSelected(i)}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.label}: revenue ${rs(r.revenue)}, expense ${rs(r.totalExpense)}, net profit ${rs(r.netProfit)}`}
                    style={{ width: groupWidth, height: CHART_HEIGHT + 20, backgroundColor: active ? d.pressed : "transparent", borderRadius: 6 }}
                  >
                    <View className="flex-row justify-center" style={{ height: CHART_HEIGHT, gap: 3 }}>
                      {series.map((s) => {
                        const v = s.value(r);
                        const h = Math.max(barHeight(v), v === 0 ? 0 : 2);
                        return (
                          <View
                            key={s.key}
                            style={{
                              position: "relative",
                              top: v >= 0 ? zeroY - h : zeroY,
                              width: BAR_WIDTH,
                              height: h,
                              backgroundColor: s.color,
                              opacity: active ? 1 : 0.75,
                              borderTopLeftRadius: v >= 0 ? 3 : 0,
                              borderTopRightRadius: v >= 0 ? 3 : 0,
                              borderBottomLeftRadius: v < 0 ? 3 : 0,
                              borderBottomRightRadius: v < 0 ? 3 : 0,
                            }}
                          />
                        );
                      })}
                    </View>
                    <Text numberOfLines={1} style={{ textAlign: "center", color: active ? d.text : d.muted, fontSize: 10, fontWeight: active ? "700" : "400", marginTop: 4 }}>
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Legend */}
      <View className="flex-row flex-wrap justify-center" style={{ columnGap: 16, rowGap: 6 }}>
        {series.map((s) => (
          <View key={s.key} className="flex-row items-center gap-1.5">
            <View className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            <Text style={{ color: d.sub, fontSize: 12 }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Numbers of the tapped period */}
      {point ? (
        <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-lg px-3.5 py-2.5" style={{ backgroundColor: d.rowExpanded, borderWidth: 1, borderColor: d.border }}>
          <Text style={{ color: d.text, fontSize: 13, fontWeight: "700" }}>{point.label}</Text>
          <View className="flex-row flex-wrap" style={{ columnGap: 12, rowGap: 2 }}>
            {series.map((s) => (
              <Text key={s.key} style={{ color: s.color, fontSize: 12, fontWeight: "700" }}>
                {rs(s.value(point))}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** One period of the breakdown: net profit on top, then where the money came from and went. */
function BreakdownRow({ row }: { row: Row }) {
  const d = useDashboardPalette();
  const up = row.netProfit >= 0;

  return (
    <View className="gap-3 rounded-xl p-4" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
      <View className="flex-row items-center justify-between gap-3">
        <Text style={{ color: d.text, fontSize: 14, fontWeight: "700" }}>{row.label}</Text>
        <View className="items-end">
          <Text style={{ color: d.muted, fontSize: 10, fontWeight: "600", letterSpacing: 0.8 }}>NET PROFIT</Text>
          <Text style={{ color: up ? d.revenue : d.red.icon, fontSize: 15, fontWeight: "800" }}>{rs(row.netProfit)}</Text>
        </View>
      </View>

      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        <Figure label="Revenue" value={row.revenue} color={d.revenue} />
        <Figure label="Purchase Exp." value={row.purchaseExpense} />
        <Figure label="Wastage Exp." value={row.wastageExpense} />
        <Figure label="Manual Exp." value={row.manualExpense} />
      </View>

      <View className="flex-row items-center justify-between pt-2.5" style={{ borderTopWidth: 1, borderColor: d.border }}>
        <Text style={{ color: d.sub, fontSize: 12 }}>Total Expense</Text>
        <Text style={{ color: d.text, fontSize: 13, fontWeight: "700" }}>{rs(row.totalExpense)}</Text>
      </View>
    </View>
  );
}

function Figure({ label, value, color }: { label: string; value: number; color?: string }) {
  const d = useDashboardPalette();
  return (
    <View className="rounded-lg px-3 py-2" style={{ flexGrow: 1, flexBasis: "45%", backgroundColor: d.rowExpanded }}>
      <Text style={{ color: d.muted, fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Text>
      <Text style={{ color: color ?? d.title, fontSize: 13, fontWeight: "700", marginTop: 2 }}>{rs(value)}</Text>
    </View>
  );
}

/** Pick a month: year arrows and a 3 × 4 month grid; "Any" removes the limit. */
function MonthPickerDialog({
  visible,
  title,
  value,
  onDismiss,
  onPick,
}: {
  visible: boolean;
  title: string;
  value?: string;
  onDismiss: () => void;
  onPick: (month: string | undefined) => void;
}) {
  const d = useDashboardPalette();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  useEffect(() => {
    if (visible) setYear(value ? Number(value.slice(0, 4)) : now.getFullYear());
  }, [visible, value]);

  const isFuture = (m: number) => year > now.getFullYear() || (year === now.getFullYear() && m > now.getMonth());

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        style={{ paddingHorizontal: 16 }}
        contentContainerStyle={{
          alignSelf: "center",
          width: "100%",
          maxWidth: 360,
          backgroundColor: d.card,
          borderWidth: 1,
          borderColor: d.border,
          borderRadius: 14,
          padding: 20,
          gap: 16,
        }}
      >
        <Text style={{ color: d.text, fontSize: 16, fontWeight: "700" }}>{title}</Text>

        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => setYear((y) => y - 1)} accessibilityRole="button" accessibilityLabel="Previous year" hitSlop={8} className="p-1 active:opacity-60">
            <MaterialCommunityIcons name="chevron-left" size={24} color={d.sub} />
          </Pressable>
          <Text style={{ color: d.title, fontSize: 15, fontWeight: "700" }}>{year}</Text>
          <Pressable
            onPress={() => setYear((y) => y + 1)}
            disabled={year >= now.getFullYear()}
            accessibilityRole="button"
            accessibilityLabel="Next year"
            hitSlop={8}
            className="p-1 active:opacity-60"
            style={{ opacity: year >= now.getFullYear() ? 0.3 : 1 }}
          >
            <MaterialCommunityIcons name="chevron-right" size={24} color={d.sub} />
          </Pressable>
        </View>

        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {MONTHS.map((name, i) => {
            const month = `${year}-${String(i + 1).padStart(2, "0")}`;
            const active = month === value;
            const future = isFuture(i);
            return (
              <Pressable
                key={name}
                onPress={() => onPick(month)}
                disabled={future}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: future }}
                className="items-center rounded-lg py-2.5 active:opacity-70"
                style={{
                  flexBasis: "30%",
                  flexGrow: 1,
                  backgroundColor: active ? d.chip.activeBg : d.input.bg,
                  borderWidth: 1,
                  borderColor: active ? d.chip.activeBg : d.input.border,
                  opacity: future ? 0.35 : 1,
                }}
              >
                <Text style={{ color: active ? d.chip.activeText : d.title, fontSize: 13, fontWeight: active ? "700" : "500" }}>{name}</Text>
              </Pressable>
            );
          })}
        </View>

        <View className="flex-row justify-between">
          <Pressable onPress={() => onPick(undefined)} accessibilityRole="button" className="px-2 py-2 active:opacity-60">
            <Text style={{ color: d.link, fontSize: 13, fontWeight: "600" }}>Any month</Text>
          </Pressable>
          <Pressable onPress={onDismiss} accessibilityRole="button" className="px-2 py-2 active:opacity-60">
            <Text style={{ color: d.sub, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </Portal>
  );
}
