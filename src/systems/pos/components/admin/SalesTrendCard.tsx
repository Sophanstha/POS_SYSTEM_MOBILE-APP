import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { BarChart } from "react-native-chart-kit";

import { useDashboardPalette } from "../../../../shared/theme/dashboardPalette";
import type { SalesTrendPoint, TrendPeriod } from "../../types/admin";

const CHART_HEIGHT = 220;
/** chart-kit draws the bars in the top 75% (plus 16 px padding); the x labels go below. */
const PLOT_TOP = 16;
const PLOT_SHARE = 0.75;
/** Room on the left for the y-axis amounts ("6.1k"). */
const Y_AXIS_WIDTH = 44;
/** chart-kit's full bar width; barPercentage scales it. */
const CHART_KIT_BAR = 32;
const TOOLTIP_WIDTH = 120;
/** Most axis labels that fit on a phone; the rest are skipped (every 2nd, 3rd…). */
const MAX_AXIS_LABELS = 8;

export const PERIOD_DESCRIPTION: Record<TrendPeriod, string> = {
  hourly: "Today by hour",
  weekly: "Last 7 days",
  monthly: "Last 4 weeks",
};

const COMPARISON_LABEL: Record<TrendPeriod, string> = {
  hourly: "vs previous hour",
  weekly: "vs yesterday",
  monthly: "vs last week",
};

/** "Rs. 12,500" like the web. */
export const rs = (n: number) => `Rs. ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** Y-axis amounts: "850", "6.1k", "1.2M". */
function compact(value: string): string {
  const n = Number(value);
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1_000) return `${Number((n / 1_000).toFixed(1))}k`;
  return String(Math.round(n));
}

function axisLabel(label: string, period: TrendPeriod, bars: number): string {
  if (period === "weekly") return label.slice(0, 3);
  if (period === "monthly") return label.replace("Week ", "W");
  // Many hours on a narrow phone: "14:00" → "14".
  return bars > MAX_AXIS_LABELS ? label.slice(0, 2) : label;
}

/** Latest bar against the one before it (same as the web; no extra API call). */
function getComparison(trend: SalesTrendPoint[]) {
  if (trend.length < 2) return null;
  const latest = trend[trend.length - 1]!;
  const previous = trend[trend.length - 2]!;
  if (previous.total === 0) {
    return latest.total === 0 ? { pct: 0, direction: "flat" as const } : { pct: 100, direction: "up" as const };
  }
  const pct = ((latest.total - previous.total) / previous.total) * 100;
  const direction = pct > 0.05 ? ("up" as const) : pct < -0.05 ? ("down" as const) : ("flat" as const);
  return { pct, direction };
}

type SalesTrendCardProps = {
  trend: SalesTrendPoint[];
  period: TrendPeriod;
  /** First load: grey placeholder bars. */
  loading: boolean;
  /** Reloading in the background: small spinner on the Refresh button. */
  refreshing: boolean;
  onRefresh: () => void;
};

/** "Sales Trend" card: totals, change vs the previous bar, bar chart (tap a bar for details). */
export default function SalesTrendCard({ trend, period, loading, refreshing, onRefresh }: SalesTrendCardProps) {
  const d = useDashboardPalette();
  const [selected, setSelected] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  // New data → hide the old tooltip.
  useEffect(() => setSelected(null), [trend, period]);

  const max = Math.max(...trend.map((t) => t.total), 1);
  const revenue = trend.reduce((sum, t) => sum + t.total, 0);
  const orders = trend.reduce((sum, t) => sum + t.count, 0);
  const comparison = getComparison(trend);
  const labelEvery = Math.ceil(trend.length / MAX_AXIS_LABELS);
  const point = selected !== null ? trend[selected] : undefined;

  // chart-kit puts bar i at [slot start + width/2, + width]; half a slot wide = centred in its slot.
  const plotWidth = Math.max(chartWidth - Y_AXIS_WIDTH, 0);
  const slot = trend.length > 0 ? plotWidth / trend.length : 0;
  const barPercentage = Math.min(1, slot / 2 / CHART_KIT_BAR);

  const tooltipLeft =
    selected !== null
      ? Math.min(Math.max(Y_AXIS_WIDTH + (selected + 0.5) * slot - TOOLTIP_WIDTH / 2, 0), chartWidth - TOOLTIP_WIDTH)
      : 0;

  return (
    <View className="gap-4 rounded-xl p-5" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
      {/* Header */}
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <View className="h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: d.brand.tile }}>
              <MaterialCommunityIcons name="chart-bar" size={15} color={d.brand.icon} />
            </View>
            <Text style={{ color: d.title, fontSize: 14, fontWeight: "600" }}>Sales Trend</Text>
            <Text style={{ color: d.muted, fontSize: 12 }}>— {PERIOD_DESCRIPTION[period]}</Text>
          </View>

          {!loading && trend.length > 0 ? (
            <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1.5 pl-9">
              <Text style={{ color: d.sub, fontSize: 12 }}>
                <Text style={{ color: d.text, fontWeight: "700" }}>{rs(revenue)}</Text> revenue
              </Text>
              <Text style={{ color: d.sub, fontSize: 12 }}>
                <Text style={{ color: d.text, fontWeight: "700" }}>{orders}</Text> orders
              </Text>
              {comparison ? (
                <View
                  className="flex-row items-center gap-1 rounded-full px-2 py-0.5"
                  style={{ backgroundColor: d.change[comparison.direction].bg }}
                >
                  <MaterialCommunityIcons
                    name={comparison.direction === "up" ? "trending-up" : comparison.direction === "down" ? "trending-down" : "minus"}
                    size={12}
                    color={d.change[comparison.direction].text}
                  />
                  <Text style={{ color: d.change[comparison.direction].text, fontSize: 11, fontWeight: "700" }}>
                    {comparison.direction === "up" ? "+" : ""}
                    {comparison.pct.toFixed(1)}% {COMPARISON_LABEL[period]}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={onRefresh}
          disabled={loading || refreshing}
          accessibilityRole="button"
          hitSlop={8}
          className="flex-row items-center gap-1.5 active:opacity-60"
          style={{ opacity: loading ? 0.5 : 1 }}
        >
          {refreshing ? (
            <ActivityIndicator size={14} color={d.muted} />
          ) : (
            <MaterialCommunityIcons name="refresh" size={15} color={d.muted} />
          )}
          <Text style={{ color: d.muted, fontSize: 12 }}>Refresh</Text>
        </Pressable>
      </View>

      {/* Chart */}
      {loading ? (
        <View className="flex-row items-end gap-2 px-1" style={{ height: CHART_HEIGHT * PLOT_SHARE }}>
          {[45, 65, 40, 80, 55, 70, 50].map((h, i) => (
            <View key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%`, backgroundColor: d.skeleton }} />
          ))}
        </View>
      ) : trend.length === 0 ? (
        <View className="items-center justify-center gap-2" style={{ height: CHART_HEIGHT * PLOT_SHARE }}>
          <MaterialCommunityIcons name="chart-bar" size={32} color={d.muted} style={{ opacity: 0.4 }} />
          <Text style={{ color: d.muted, fontSize: 12, fontWeight: "500" }}>No sales data for this period.</Text>
        </View>
      ) : (
        <View onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)} style={{ height: CHART_HEIGHT }}>
          {chartWidth > 0 ? (
            <BarChart
              width={chartWidth}
              height={CHART_HEIGHT}
              data={{
                labels: trend.map((t, i) => (i % labelEvery === 0 ? axisLabel(t.label, period, trend.length) : "")),
                datasets: [
                  {
                    data: trend.map((t) => t.total),
                    // Busiest bar darker, tapped bar highlighted (web: hover).
                    colors: trend.map((t, i) => {
                      const fill = i === selected ? d.bar.selected : t.total === max ? d.bar.maxFill : d.bar.fill;
                      return () => fill;
                    }),
                  },
                ],
              }}
              yAxisLabel=""
              yAxisSuffix=""
              fromZero
              withCustomBarColorFromData
              flatColor
              showBarTops
              segments={4}
              style={{ paddingRight: Y_AXIS_WIDTH }}
              chartConfig={{
                backgroundGradientFrom: d.card,
                backgroundGradientTo: d.card,
                backgroundGradientFromOpacity: 0,
                backgroundGradientToOpacity: 0,
                decimalPlaces: 0,
                barPercentage,
                barRadius: 4,
                color: () => d.bar.top,
                labelColor: () => d.muted,
                formatYLabel: compact,
                propsForBackgroundLines: { stroke: d.border, strokeDasharray: "4 4" },
                propsForLabels: { fontSize: 10 },
              }}
            />
          ) : null}

          {/* Tap areas over the bars (chart-kit's BarChart has no press handler). */}
          <View
            className="absolute flex-row"
            style={{ left: Y_AXIS_WIDTH, top: 0, width: plotWidth, height: PLOT_TOP + CHART_HEIGHT * PLOT_SHARE }}
          >
            {trend.map((item, i) => (
              <Pressable
                key={`${item.label}-${i}`}
                onPress={() => setSelected(i === selected ? null : i)}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}: ${rs(item.total)}, ${item.count} orders`}
                className="flex-1"
              />
            ))}
          </View>

          {point ? (
            <View
              pointerEvents="none"
              className="absolute items-center rounded-lg px-3 py-2"
              style={{ top: 0, left: tooltipLeft, width: TOOLTIP_WIDTH, backgroundColor: d.tooltip.bg, elevation: 6 }}
            >
              <Text style={{ color: d.tooltip.label, fontSize: 11, fontWeight: "600" }}>{point.label}</Text>
              <Text style={{ color: d.tooltip.value, fontSize: 13, fontWeight: "700" }}>{rs(point.total)}</Text>
              <Text style={{ color: d.tooltip.sub, fontSize: 10 }}>
                {point.count} {point.count === 1 ? "order" : "orders"}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}