import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Animated, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Button, Snackbar } from "react-native-paper";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../../shared/api/client";
import KitchenTicketCard from "../components/kitchen/KitchenTicketCard";
import WastageSheet from "../components/kitchen/WastageSheet";
import { Bone, Skeleton } from "../../../shared/components/Skeleton";
import { usePosAuth } from "../auth/PosAuthProvider";
import { useThemeMode } from "../../../shared/context/ThemeContext";
import { useKitchenBoard, useMoveKitchenItem, type KitchenCard, type KitchenMove, type KitchenStage } from "../hooks/useKitchen";
import { useLayout } from "../../../shared/hooks/useLayout";
import { useNewOrderAlert } from "../hooks/useNewOrderAlert";
import { useKdsPalette, type KdsPalette } from "../theme/kdsPalette";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const STAGES: { stage: KitchenStage; label: string; short: string; empty: string }[] = [
  { stage: "new", label: "New Orders", short: "New", empty: "No new orders" },
  { stage: "preparing", label: "Preparing", short: "Preparing", empty: "Nothing on the stove" },
  { stage: "ready", label: "Ready to Serve", short: "Ready", empty: "Nothing waiting to be served" },
];

const GAP = 14;

/** Re-renders every `ms` so timers and the clock move. */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/**
 * Kitchen Display, like the web KDS: every dish is a sticky note in
 * New Orders → Preparing → Ready to Serve. Phone: one column with tabs.
 * Landscape / tablet: the three columns side by side.
 * New order: bell + buzz + flashing banner; the screen never turns off.
 */
export default function KitchenScreen() {
  const k = useKdsPalette();
  const insets = useSafeAreaInsets();
  const { isWide, width } = useLayout();
  const { hasPermission, logout } = usePosAuth();
  const { isDark, toggleTheme } = useThemeMode();

  const { query, cards } = useKitchenBoard();
  const move = useMoveKitchenItem();
  const now = useNow(5000);
  useKeepAwake();

  const [soundOn, setSoundOn] = useState(true);
  const bell = useNewOrderAlert(query.data, soundOn);

  const [tab, setTab] = useState<KitchenStage>("new");
  const [pulling, setPulling] = useState(false);
  const [wastageOpen, setWastageOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canUpdate = hasPermission("restaurant.kot.update");
  const canReportWastage = hasPermission("inventory.stock.update") && hasPermission("inventory.stock.read");

  const byStage = useMemo(() => {
    const groups: Record<KitchenStage, KitchenCard[]> = { new: [], preparing: [], ready: [] };
    for (const card of cards) groups[card.stage].push(card);
    return groups;
  }, [cards]);

  const minutesOf = (card: KitchenCard) => Math.max(0, Math.floor((now - Date.parse(card.createdAt)) / 60000));
  const busyId = move.isPending ? move.variables?.card.kotItemId : undefined;

  const doMove = (card: KitchenCard, m: KitchenMove) =>
    move.mutate({ card, move: m }, { onError: (e) => setMessage(getErrorMessage(e)) });

  const refresh = async () => {
    setPulling(true);
    await query.refetch();
    setPulling(false);
  };

  const renderList = (stage: KitchenStage, columns: number) => {
    const info = STAGES.find((s) => s.stage === stage)!;
    return (
      <FlatList
        key={`${stage}-${columns}`} // numColumns can't change on the fly
        data={byStage[stage]}
        keyExtractor={(c) => c.kotItemId}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: GAP } : undefined}
        contentContainerStyle={{ gap: GAP, padding: 10, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}
        renderItem={({ item }) => (
          <View style={{ flex: 1 / columns }}>
            <KitchenTicketCard
              card={item}
              minutes={minutesOf(item)}
              canUpdate={canUpdate}
              busy={busyId === item.kotItemId}
              onMove={(m) => doMove(item, m)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center gap-2 py-16">
            <MaterialCommunityIcons name="silverware-clean" size={32} color={k.muted} />
            <Text style={{ color: k.muted, fontSize: 13, fontWeight: "600" }}>{info.empty}</Text>
          </View>
        }
      />
    );
  };

  const header = (
    <View
      className="flex-row items-center justify-between gap-3 py-3"
      style={{
        backgroundColor: k.headerBg,
        borderBottomWidth: 1,
        borderColor: k.headerBorder,
        paddingLeft: insets.left + 16,
        paddingRight: insets.right + 16,
      }}
    >
      <View className="flex-1 flex-row items-center gap-3">
        <Text numberOfLines={1} style={{ color: k.title, fontSize: 16, fontWeight: "700" }}>
          Kitchen Display
        </Text>
        <Text style={{ color: k.muted, fontSize: 12, fontVariant: ["tabular-nums"] }}>
          {new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        {canReportWastage ? (
          <HeaderButton k={k} icon="delete-outline" label={isWide ? "Report Wastage" : undefined} onPress={() => setWastageOpen(true)} />
        ) : null}
        <HeaderButton
          k={k}
          icon={soundOn ? "bell-ring-outline" : "bell-off-outline"}
          accessibilityLabel={soundOn ? "Turn the order bell off" : "Turn the order bell on"}
          onPress={() => {
            setMessage(soundOn ? "Order bell off. New orders still buzz and flash." : "Order bell on");
            setSoundOn((on) => !on);
          }}
        />
        <HeaderButton
          k={k}
          icon={isDark ? "white-balance-sunny" : "moon-waning-crescent"}
          accessibilityLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
          onPress={toggleTheme}
        />
        <HeaderButton k={k} icon="cog-outline" label={isWide ? "Settings" : undefined} accessibilityLabel="Settings" onPress={() => router.push("/pos/kitchen/settings")} />
        <HeaderButton k={k} icon="logout" label={isWide ? "Logout" : undefined} accessibilityLabel="Logout" danger onPress={logout} />
      </View>
    </View>
  );

  let body: ReactNode;

  if (query.isLoading) {
    body = (
      <Skeleton style={{ flexDirection: "row", gap: GAP, padding: 16 }}>
        {Array.from({ length: isWide ? 3 : 1 }, (_, i) => (
          <View key={i} className="flex-1 gap-4">
            <Bone height={44} radius={14} />
            <Bone height={150} radius={12} />
            <Bone height={150} radius={12} />
          </View>
        ))}
      </Skeleton>
    );
  } else if (query.error && !query.data) {
    body = (
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text style={{ color: k.title, fontSize: 14, textAlign: "center" }}>{getErrorMessage(query.error)}</Text>
        <Button mode="outlined" icon="refresh" onPress={() => query.refetch()}>
          Try again
        </Button>
      </View>
    );
  } else if (isWide) {
    // Three columns side by side; a wide column fits two notes per row.
    const columnWidth = (width - insets.left - insets.right - 32 - GAP * 2) / 3;
    const perRow = columnWidth >= 440 ? 2 : 1;
    body = (
      <View className="flex-1 flex-row" style={{ gap: GAP, paddingTop: 16, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }}>
        {STAGES.map(({ stage, label }) => (
          <View key={stage} className="flex-1">
            <ColumnHeader k={k} stage={stage} label={label} count={byStage[stage].length} />
            {renderList(stage, perRow)}
          </View>
        ))}
      </View>
    );
  } else {
    // Phone: tabs like the web's mobile view.
    body = (
      <View className="flex-1">
        <View className="flex-row gap-1 p-2" style={{ backgroundColor: k.tabsBg, borderBottomWidth: 1, borderColor: k.headerBorder }}>
          {STAGES.map(({ stage, short }) => {
            const active = tab === stage;
            const col = k.column[stage];
            return (
              <Pressable
                key={stage}
                onPress={() => setTab(stage)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2 active:opacity-70"
                style={{ backgroundColor: active ? k.tabActiveBg : "transparent" }}
              >
                <Text style={{ color: active ? k.title : k.muted, fontSize: 13, fontWeight: "700" }}>{short}</Text>
                <View className="rounded-full px-1.5" style={{ backgroundColor: col.countBg }}>
                  <Text style={{ color: col.countText, fontSize: 11, fontWeight: "800" }}>{byStage[stage].length}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {renderList(tab, width >= 560 ? 2 : 1)}
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: k.boardBg }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: k.headerBg }}>
        {header}
      </SafeAreaView>

      {bell.unseen > 0 ? (
        <NewOrderBanner
          count={bell.unseen}
          onPress={() => {
            bell.markSeen();
            setTab("new");
          }}
        />
      ) : null}

      {body}

      <WastageSheet visible={wastageOpen} onDismiss={() => setWastageOpen(false)} onReported={setMessage} />

      <Snackbar visible={!!message} onDismiss={() => setMessage(null)} duration={3500}>
        {message ?? ""}
      </Snackbar>
    </View>
  );
}

/** Flashing strip under the header. Tap = stop the bell and show New Orders. */
function NewOrderBanner({ count, onPress }: { count: number; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const label = count === 1 ? "1 new order" : `${count} new orders`;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}. Tap to stop the bell`}>
      <Animated.View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: "#e5b83b",
          opacity: pulse,
        }}
      >
        <MaterialCommunityIcons name="bell-ring" size={18} color="#451a03" />
        <Text style={{ color: "#451a03", fontSize: 14, fontWeight: "800" }}>{label} · Tap to stop the bell</Text>
      </Animated.View>
    </Pressable>
  );
}

function ColumnHeader({ k, stage, label, count }: { k: KdsPalette; stage: KitchenStage; label: string; count: number }) {
  const col = k.column[stage];
  return (
    <View
      className="flex-row items-center justify-between rounded-xl px-4 py-3"
      style={{ backgroundColor: col.bg, borderWidth: 1, borderColor: col.border }}
    >
      <Text style={{ color: col.text, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: col.countBg, borderWidth: 1, borderColor: col.border }}>
        <Text style={{ color: col.countText, fontSize: 11, fontWeight: "800" }}>{count}</Text>
      </View>
    </View>
  );
}

function HeaderButton({
  k,
  icon,
  label,
  accessibilityLabel,
  danger,
  onPress,
}: {
  k: KdsPalette;
  icon: IconName;
  label?: string;
  accessibilityLabel?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const color = danger ? "#ef4444" : k.button.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      className="flex-row items-center gap-1.5 rounded-xl px-2.5 py-2 active:opacity-70"
      style={{ backgroundColor: k.button.bg, borderWidth: 1, borderColor: k.button.border }}
    >
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      {label ? <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{label}</Text> : null}
    </Pressable>
  );
}