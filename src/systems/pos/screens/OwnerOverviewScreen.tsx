import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { getErrorMessage } from "../../../shared/api/client";
import { AdminButton, AdminEmpty, AdminHero, AdminStat, FilterChips, PickerField, useAdminContentWidth } from "../../../shared/components/AdminUI";
import { rs } from "../components/admin/SalesTrendCard";
import { useBranchSummaries, useOrgOutlets, useOrgReport, useTrialStatus } from "../hooks/useAdmin";
import { useDashboardPalette } from "../../../shared/theme/dashboardPalette";
import type { BranchSummary, OrgPeriod, OrgReport, TrialStatus } from "../types/admin";
import type { PaymentMethod } from "../types/pos";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const ALL = "all";

/** Same colours as the web branch comparison. */
const BRANCH_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7", "#14b8a6", "#f97316"];

const PAYMENT_ROWS: { method: PaymentMethod; label: string; color: string }[] = [
  { method: "cash", label: "Cash", color: "#10b981" },
  { method: "card", label: "Card", color: "#3b82f6" },
  { method: "qr", label: "QR", color: "#a855f7" },
  { method: "yango", label: "Yango", color: "#06b6d4" },
  { method: "foodmandu", label: "Foodmandu", color: "#f97316" },
  { method: "pathao", label: "Pathao", color: "#f43f5e" },
];

const PERIOD_TEXT: Record<OrgPeriod, string> = { "7d": "Last 7 Days", "30d": "Last 30 Days", "90d": "Last 90 Days" };
const COMPARE_TEXT: Record<OrgPeriod, string> = { "7d": "vs previous day", "30d": "vs previous week", "90d": "vs previous month" };

const CHART_HEIGHT = 170;

/** Branch pie: size, outer / inner (hole) radius, centre. */
const PIE_SIZE = 210;
const PIE_OUTER = 92;
const PIE_INNER = 58;
const PIE_C = PIE_SIZE / 2;

/** Point on the pie; angle in radians, clockwise from 12 o'clock. */
const polar = (r: number, a: number) => `${PIE_C + r * Math.sin(a)} ${PIE_C - r * Math.cos(a)}`;

/** SVG path of one donut slice from `start` to `end` (radians). */
function donutSlice(start: number, end: number, outer: number, inner: number) {
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${polar(outer, start)} A ${outer} ${outer} 0 ${large} 1 ${polar(outer, end)} L ${polar(inner, end)} A ${inner} ${inner} 0 ${large} 0 ${polar(inner, start)} Z`;
}

/** "Monday" → "Mon", "Week 2" → "W2", "Month 3" → "M3". */
const shortLabel = (label: string) =>
  /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day$/.test(label) ? label.slice(0, 3) : label.replace(/^Week /, "W").replace(/^Month /, "M");

/** Latest point against the one before it (web: "vs previous day"). */
function getComparison(trend: OrgReport["salesTrend"]) {
  if (trend.length < 2) return null;
  const latest = trend[trend.length - 1]!;
  const previous = trend[trend.length - 2]!;
  if (previous.total === 0) return latest.total === 0 ? { pct: 0, direction: "flat" as const } : { pct: 100, direction: "up" as const };
  const pct = ((latest.total - previous.total) / previous.total) * 100;
  return { pct, direction: pct > 0.05 ? ("up" as const) : pct < -0.05 ? ("down" as const) : ("flat" as const) };
}

/**
 * Owner "Organization Reports", like the web: all branches together or one branch,
 * last 7 / 30 / 90 days — revenue, orders, average order, staff, branch comparison,
 * sales trend, payment methods, popular items and the staff leaderboard.
 */
export default function OwnerOverviewScreen() {
  const d = useDashboardPalette();
  const insets = useSafeAreaInsets();
  const contentWidth = useAdminContentWidth();

  const [outletId, setOutletId] = useState<string>(ALL);
  const [period, setPeriod] = useState<OrgPeriod>("7d");
  const [pulling, setPulling] = useState(false);

  const outlets = useOrgOutlets();
  const report = useOrgReport(period, outletId === ALL ? null : outletId);
  const branches = useBranchSummaries(period, outlets.data, outletId === ALL);
  const trial = useTrialStatus();

  const data = report.data;
  const comparison = data ? getComparison(data.salesTrend) : null;
  const statBasis = contentWidth >= 900 ? "22%" : "45%";

  const refresh = async () => {
    setPulling(true);
    await Promise.all([report.refetch(), outlets.refetch(), outletId === ALL ? branches.refetch() : null, trial.refetch()]);
    setPulling(false);
  };

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}
      contentContainerStyle={{
        gap: 20,
        paddingTop: 16,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
        width: "100%",
        maxWidth: 1100,
        alignSelf: "center",
      }}
    >
      <AdminHero title="Organization Reports" subtitle={PERIOD_TEXT[period]}>
        <FilterChips<OrgPeriod>
          options={[
            { value: "7d", label: "Last 7 Days" },
            { value: "30d", label: "Last 30 Days" },
            { value: "90d", label: "Last 90 Days" },
          ]}
          value={period}
          onChange={setPeriod}
        />
      </AdminHero>

      {trial.data ? <TrialBanner trial={trial.data} /> : null}

      <PickerField
        icon="storefront-outline"
        placeholder="All Branches Combined"
        value={outletId}
        searchable={(outlets.data?.length ?? 0) > 6}
        searchPlaceholder="Search outlets..."
        options={[
          { value: ALL, label: "All Branches Combined", icon: "domain" },
          ...(outlets.data ?? []).map((o) => ({ value: o.id, label: o.name, hint: o.isActive ? undefined : "Inactive" })),
        ]}
        onChange={setOutletId}
      />

      {report.isLoading ? (
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} className="rounded-xl" style={{ flexGrow: 1, flexBasis: statBasis, height: 84, backgroundColor: d.skeleton }} />
          ))}
        </View>
      ) : report.error && !data ? (
        <AdminEmpty icon="alert-circle-outline" text={getErrorMessage(report.error, "Failed to load report data.")} error />
      ) : data ? (
        <>
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            <AdminStat basis={statBasis} tone="emerald" icon="cash-multiple" label="Net Revenue" value={rs(data.summary.totalRevenue)} />
            <AdminStat basis={statBasis} tone="blue" icon="shopping-outline" label="Total Orders" value={data.summary.totalOrders.toLocaleString("en-US")} />
            <AdminStat basis={statBasis} tone="amber" icon="trending-up" label="Avg Order Value" value={rs(data.summary.avgOrderValue)} />
            <AdminStat basis={statBasis} tone="slate" icon="account-group-outline" label="Active Staff" value={String(data.summary.activeStaff)} />
          </View>
          {comparison ? <ChangeBadge pct={comparison.pct} direction={comparison.direction} label={COMPARE_TEXT[period]} /> : null}

          {outletId === ALL ? (
            <Card icon="compare-horizontal" title="Branch Revenue Comparison" subtitle="Revenue performance across all outlet branches">
              {branches.isLoading ? (
                <ActivityIndicator color={d.link} style={{ alignSelf: "flex-start" }} />
              ) : (branches.data ?? []).length === 0 ? (
                <Text style={{ color: d.muted, fontSize: 13 }}>No branch data available</Text>
              ) : (
                <BranchPie branches={branches.data ?? []} wide={contentWidth >= 640} onPick={setOutletId} />
              )}
            </Card>
          ) : null}

          <Card icon="chart-bar" title="Sales Trend" subtitle="Revenue over the selected period">
            {data.salesTrend.length === 0 ? (
              <Text style={{ color: d.muted, fontSize: 13 }}>No sales data for this period.</Text>
            ) : (
              <TrendBars trend={data.salesTrend} />
            )}
          </Card>

          <View className={contentWidth >= 760 ? "flex-row" : ""} style={{ gap: 20 }}>
            <View style={{ flex: 1 }}>
              <Card icon="credit-card-outline" title="Payment Methods">
                <PaymentMethods report={data} />
              </Card>
            </View>
            <View style={{ flex: 1 }}>
              <Card icon="silverware-fork-knife" title="Popular Items" subtitle="Best performing items by quantity sold">
                {data.popularItems.length === 0 ? (
                  <Text style={{ color: d.muted, fontSize: 13 }}>No items data available</Text>
                ) : (
                  data.popularItems.map((item, i) => (
                    <RankRow
                      key={`${item.name}-${i}`}
                      rank={i + 1}
                      title={item.name}
                      subtitle={`${item.categoryName ?? "Uncategorized"} · ${item.totalSold} sold`}
                      value={rs(Number(item.grossSales ?? 0))}
                    />
                  ))
                )}
              </Card>
            </View>
          </View>

          <Card icon="trophy-outline" title="Staff Leaderboard" subtitle="Rankings based on processed sales volume">
            {data.leaderboard.length === 0 ? (
              <Text style={{ color: d.muted, fontSize: 13 }}>No staff data available</Text>
            ) : (
              data.leaderboard.map((s) => (
                <RankRow
                  key={`${s.rank}-${s.staffName}`}
                  rank={s.rank}
                  title={s.staffName}
                  subtitle={`${s.totalOrders} order${s.totalOrders === 1 ? "" : "s"}`}
                  value={rs(Number(s.totalVolume ?? 0))}
                />
              ))
            )}
          </Card>
        </>
      ) : (
        <AdminEmpty icon="store-outline" text="No transactions recorded for the selected period." />
      )}
    </ScrollView>
  );
}

/** Trial ends in ≤ 5 days, or the trial is over (web: notification bell). */
function TrialBanner({ trial }: { trial: TrialStatus }) {
  const d = useDashboardPalette();
  const daysLeft = trial.trialEndsAt ? Math.max(0, Math.ceil((new Date(trial.trialEndsAt).getTime() - Date.now()) / 86_400_000)) : null;
  const suspended = trial.status === "suspended";
  if (!suspended && !(trial.status === "trial" && daysLeft !== null && daysLeft <= 5)) return null;

  return (
    <View className="flex-row items-start gap-3 rounded-xl p-4" style={{ backgroundColor: suspended ? d.error.bg : d.banner.bg, borderWidth: 1, borderColor: suspended ? d.error.border : d.banner.border }}>
      <MaterialCommunityIcons name="alert-outline" size={20} color={suspended ? d.error.text : d.banner.icon} />
      <View className="flex-1">
        <Text style={{ color: suspended ? d.error.text : d.banner.title, fontSize: 13, fontWeight: "700" }}>
          {suspended ? "Trial has ended" : `Trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
        </Text>
        <Text style={{ color: suspended ? d.error.text : d.banner.text, fontSize: 12, marginTop: 2 }}>
          {suspended ? "Your account access is currently paused. Contact support to reactivate." : "Upgrade now to avoid any interruption to your account."}
        </Text>
      </View>
    </View>
  );
}

function ChangeBadge({ pct, direction, label }: { pct: number; direction: "up" | "down" | "flat"; label: string }) {
  const d = useDashboardPalette();
  const c = d.change[direction];
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full px-2.5 py-1" style={{ backgroundColor: c.bg, marginTop: -8 }}>
      <MaterialCommunityIcons name={direction === "up" ? "trending-up" : direction === "down" ? "trending-down" : "minus"} size={13} color={c.text} />
      <Text style={{ color: c.text, fontSize: 11, fontWeight: "700" }}>
        Revenue {direction === "up" ? "+" : ""}
        {pct.toFixed(1)}% {label}
      </Text>
    </View>
  );
}

function Card({ icon, title, subtitle, children }: { icon: IconName; title: string; subtitle?: string; children: ReactNode }) {
  const d = useDashboardPalette();
  return (
    <View className="gap-4 rounded-xl p-5" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
      <View className="flex-row items-center gap-2">
        <View className="h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: d.brand.tile }}>
          <MaterialCommunityIcons name={icon} size={15} color={d.brand.icon} />
        </View>
        <View className="flex-1">
          <Text style={{ color: d.title, fontSize: 14, fontWeight: "600" }}>{title}</Text>
          {subtitle ? <Text style={{ color: d.muted, fontSize: 12 }}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

/**
 * Each branch's share of revenue as a donut. Tap a slice or a row to highlight it
 * (its revenue shows in the middle), then "Open report" for that branch.
 */
function BranchPie({ branches, wide, onPick }: { branches: BranchSummary[]; wide: boolean; onPick: (id: string) => void }) {
  const d = useDashboardPalette();
  const [selected, setSelected] = useState<string | null>(null);

  const total = branches.reduce((sum, b) => sum + b.revenue, 0);
  const slices = useMemo(() => {
    let angle = 0;
    return [...branches]
      .sort((a, b) => b.revenue - a.revenue)
      .map((b, i) => {
        const share = total > 0 ? b.revenue / total : 0;
        const slice = { ...b, color: BRANCH_COLORS[i % BRANCH_COLORS.length]!, share, start: angle, end: angle + share * 2 * Math.PI };
        angle = slice.end;
        return slice;
      });
  }, [branches, total]);

  const picked = slices.find((s) => s.outletId === selected) ?? null;
  const toggle = (id: string) => setSelected((current) => (current === id ? null : id));

  return (
    <View className={wide ? "flex-row items-center" : ""} style={{ gap: 20 }}>
      <View style={{ width: PIE_SIZE, height: PIE_SIZE, alignSelf: "center" }}>
        <Svg width={PIE_SIZE} height={PIE_SIZE}>
          {total <= 0 ? (
            <Circle cx={PIE_C} cy={PIE_C} r={(PIE_OUTER + PIE_INNER) / 2} stroke={d.skeleton} strokeWidth={PIE_OUTER - PIE_INNER} fill="none" />
          ) : (
            slices
              .filter((s) => s.share > 0)
              .map((s) => {
                const active = picked?.outletId === s.outletId;
                const outer = active ? PIE_OUTER + 8 : PIE_OUTER;
                const opacity = picked && !active ? 0.35 : 1;
                // One branch with all the revenue: a full ring (an arc can't start and end at the same point).
                return s.share >= 0.9999 ? (
                  <Circle
                    key={s.outletId}
                    cx={PIE_C}
                    cy={PIE_C}
                    r={(outer + PIE_INNER) / 2}
                    stroke={s.color}
                    strokeWidth={outer - PIE_INNER}
                    fill="none"
                    opacity={opacity}
                    onPress={() => toggle(s.outletId)}
                  />
                ) : (
                  <Path
                    key={s.outletId}
                    d={donutSlice(s.start, s.end, outer, PIE_INNER)}
                    fill={s.color}
                    stroke={d.card}
                    strokeWidth={2}
                    opacity={opacity}
                    onPress={() => toggle(s.outletId)}
                  />
                );
              })
          )}
        </Svg>
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center" style={{ paddingHorizontal: PIE_C - PIE_INNER + 10 }}>
          <Text numberOfLines={1} style={{ color: d.muted, fontSize: 11 }}>
            {picked ? picked.name : "Total revenue"}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: d.text, fontSize: 16, fontWeight: "800" }}>
            {rs(picked ? picked.revenue : total)}
          </Text>
          <Text numberOfLines={1} style={{ color: picked ? picked.color : d.muted, fontSize: 11, fontWeight: picked ? "700" : "400" }}>
            {picked ? `${(picked.share * 100).toFixed(1)}%` : `${branches.length} branch${branches.length === 1 ? "" : "es"}`}
          </Text>
        </View>
      </View>

      <View className="gap-1" style={wide ? { flex: 1 } : undefined}>
        {slices.map((s) => {
          const active = picked?.outletId === s.outletId;
          return (
            <Pressable
              key={s.outletId}
              onPress={() => toggle(s.outletId)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${s.name}: ${rs(s.revenue)}, ${(s.share * 100).toFixed(1)} percent, ${s.orders} orders`}
              className="flex-row items-center gap-3 rounded-lg px-3 py-2.5"
              style={({ pressed }) => ({ backgroundColor: active ? d.rowExpanded : pressed ? d.pressed : "transparent" })}
            >
              <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: s.color }} />
              <View className="flex-1">
                <Text numberOfLines={1} style={{ color: d.title, fontSize: 13, fontWeight: "600" }}>
                  {s.name}
                </Text>
                <Text style={{ color: d.muted, fontSize: 11 }}>
                  {s.orders} order{s.orders === 1 ? "" : "s"}
                </Text>
              </View>
              <View className="items-end">
                <Text style={{ color: d.text, fontSize: 13, fontWeight: "700" }}>{rs(s.revenue)}</Text>
                <Text style={{ color: d.muted, fontSize: 11 }}>{(s.share * 100).toFixed(1)}%</Text>
              </View>
            </Pressable>
          );
        })}
        {picked ? (
          <View className="mt-2 self-start">
            <AdminButton label={`Open ${picked.name} report`} icon="arrow-right" onPress={() => onPick(picked.outletId)} />
          </View>
        ) : (
          <Text style={{ color: d.muted, fontSize: 11, marginTop: 4, paddingHorizontal: 12 }}>Tap a branch to highlight it.</Text>
        )}
      </View>
    </View>
  );
}

/** Revenue per day / week / month; tap a bar for its numbers. */
function TrendBars({ trend }: { trend: OrgReport["salesTrend"] }) {
  const d = useDashboardPalette();
  const [selected, setSelected] = useState(trend.length - 1);
  useEffect(() => setSelected(trend.length - 1), [trend]);
  const max = useMemo(() => Math.max(1, ...trend.map((t) => t.total)), [trend]);
  const point = trend[selected] ?? trend[trend.length - 1];

  return (
    <View className="gap-3">
      <View className="flex-row items-end" style={{ height: CHART_HEIGHT + 18, gap: 6 }}>
        {trend.map((t, i) => {
          const active = i === selected;
          return (
            <Pressable
              key={`${t.label}-${i}`}
              onPress={() => setSelected(i)}
              accessibilityRole="button"
              accessibilityLabel={`${t.label}: ${rs(t.total)}, ${t.count} orders`}
              className="flex-1 items-center justify-end"
              style={{ height: CHART_HEIGHT + 18 }}
            >
              <View
                style={{
                  width: "70%",
                  maxWidth: 36,
                  height: Math.max((t.total / max) * CHART_HEIGHT, t.total > 0 ? 3 : 1),
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  backgroundColor: active ? d.bar.maxTop : d.bar.top,
                  opacity: active ? 1 : 0.55,
                }}
              />
              <Text numberOfLines={1} style={{ color: active ? d.text : d.muted, fontSize: 10, fontWeight: active ? "700" : "400", marginTop: 4 }}>
                {shortLabel(t.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {point ? (
        <View className="flex-row items-center justify-between rounded-lg px-3.5 py-2.5" style={{ backgroundColor: d.rowExpanded, borderWidth: 1, borderColor: d.border }}>
          <Text style={{ color: d.text, fontSize: 13, fontWeight: "700" }}>{point.label}</Text>
          <Text style={{ color: d.sub, fontSize: 12 }}>
            <Text style={{ color: d.revenue, fontWeight: "700" }}>{rs(point.total)}</Text> · {point.count} order{point.count === 1 ? "" : "s"}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Share of each payment method, like the web panel. */
function PaymentMethods({ report }: { report: OrgReport }) {
  const d = useDashboardPalette();
  const rows = PAYMENT_ROWS.map((r) => ({ ...r, share: report.paymentShare.breakdown[r.method] })).filter((r) => (r.share?.total ?? 0) > 0);

  if (rows.length === 0) return <Text style={{ color: d.muted, fontSize: 13 }}>No payments in this period.</Text>;

  return (
    <View className="gap-3">
      {rows.map((r) => (
        <View key={r.method} className="gap-1.5">
          <View className="flex-row items-center justify-between">
            <Text style={{ color: d.title, fontSize: 13, fontWeight: "600" }}>
              {r.label} <Text style={{ color: d.muted, fontWeight: "400" }}>· {Number(r.share?.percentage ?? 0).toFixed(1)}%</Text>
            </Text>
            <Text style={{ color: d.text, fontSize: 13, fontWeight: "700" }}>{rs(Number(r.share?.total ?? 0))}</Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: d.skeleton }}>
            <View style={{ width: `${Math.min(100, Number(r.share?.percentage ?? 0))}%`, height: "100%", borderRadius: 999, backgroundColor: r.color }} />
          </View>
        </View>
      ))}
      <View className="flex-row justify-between pt-2.5" style={{ borderTopWidth: 1, borderColor: d.border }}>
        <Text style={{ color: d.sub, fontSize: 12 }}>Net settled</Text>
        <Text style={{ color: d.text, fontSize: 13, fontWeight: "700" }}>{rs(report.paymentShare.netSettledAmount)}</Text>
      </View>
    </View>
  );
}

/** Numbered row: popular item or staff member. */
function RankRow({ rank, title, subtitle, value }: { rank: number; title: string; subtitle: string; value: string }) {
  const d = useDashboardPalette();
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: d.rank.bg, borderWidth: 1, borderColor: d.rank.border }}>
        <Text style={{ color: d.rank.text, fontSize: 12, fontWeight: "700" }}>{rank}</Text>
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} style={{ color: d.title, fontSize: 13, fontWeight: "600" }}>
          {title}
        </Text>
        <Text numberOfLines={1} style={{ color: d.muted, fontSize: 11 }}>
          {subtitle}
        </Text>
      </View>
      <Text style={{ color: d.revenue, fontSize: 13, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}
