import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, useWindowDimensions, View } from "react-native";
import { ActivityIndicator, Button, Chip, Dialog, Portal, Snackbar, Text } from "react-native-paper";

import { getErrorMessage } from "../api/client";
import FloorPlan from "../components/FloorPlan";
import PickupQueue from "../components/PickupQueue";
import { useAuth } from "../context/AuthContext";
import { useKotTickets } from "../hooks/useKot";
import { useMoveTable, useResetLayout, useTables } from "../hooks/useTables";
import { defaultLayout } from "../lib/FloorPlan";
import { TABLE_STATUS_LABEL } from "../lib/pos";
import { useAppTheme } from "../theme/paperTheme";
import { tableStatusColor } from "../theme/statusColors";
import type { TableStatus } from "../types/pos";

type Filter = TableStatus | "all";
const FILTERS: Filter[] = ["all", "available", "occupied", "reserved", "dirty"];

const SIDE_GUTTER = 16;

type TablesScreenProps = {
  /** Route prefix of the current role, e.g. "/waiter". */
  basePath: "/waiter" | "/cashier";
  /** Cashier: show takeaways ready for pickup above the tables (like the web). */
  showPickupQueue?: boolean;
};

/** Floor plan: every table where staff placed it. Tap a table to order; "Arrange" to move tables. */
export default function TablesScreen({ basePath, showPickupQueue = false }: TablesScreenProps) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const { hasPermission } = useAuth();

  const tables = useTables();
  const tickets = useKotTickets();
  const moveTable = useMoveTable();
  const resetLayout = useResetLayout();

  const [filter, setFilter] = useState<Filter>("all");
  const [pulling, setPulling] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const all = tables.data ?? [];
  const occupied = all.filter((t) => t.status === "occupied").length;
  const occupancy = all.length ? Math.round((occupied / all.length) * 100) : 0;
  const canArrange = hasPermission("restaurant.tables.update");

  if (tables.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (tables.error && !tables.data) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Text variant="bodyMedium" style={{ color: theme.colors.error, textAlign: "center" }}>
          {getErrorMessage(tables.error)}
        </Text>
        <Button mode="outlined" icon="refresh" onPress={() => tables.refetch()}>
          Try again
        </Button>
      </View>
    );
  }

  const doReset = () => {
    resetLayout.mutate(defaultLayout(all), {
      onSuccess: () => setMessage("Tables put back in a grid"),
      onError: (e) => setMessage(getErrorMessage(e)),
      onSettled: () => setConfirmReset(false),
    });
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        scrollEnabled={!dragging}
        contentContainerClassName="gap-3 px-4 pb-8 pt-1"
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={async () => {
              setPulling(true);
              await Promise.all([tables.refetch(), tickets.refetch()]);
              setPulling(false);
            }}
            tintColor={theme.colors.primary}
          />
        }
      >
        {showPickupQueue ? <PickupQueue /> : null}

        <View className="flex-row items-center justify-between gap-2">
          <Text variant="bodyMedium" style={{ flex: 1, color: theme.colors.onSurfaceVariant }}>
            {occupied} of {all.length} occupied · {occupancy}%
          </Text>
          {canArrange && all.length > 0 ? (
            <View className="flex-row items-center gap-1">
              <Button compact icon="view-grid-outline" onPress={() => setConfirmReset(true)} disabled={resetLayout.isPending}>
                Reset layout
              </Button>
              <Button
                compact
                mode={arranging ? "contained" : "outlined"}
                icon={arranging ? "check" : "arrow-all"}
                onPress={() => setArranging((a) => !a)}
              >
                {arranging ? "Done" : "Arrange"}
              </Button>
            </View>
          ) : null}
        </View>

        {arranging ? (
          <Text variant="bodySmall" style={{ color: theme.colors.primary }}>
            Drag a table to move it. Each move is saved, also for the web POS.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {FILTERS.map((f) => (
              <Chip
                key={f}
                selected={filter === f}
                showSelectedCheck={false}
                mode={filter === f ? "flat" : "outlined"}
                onPress={() => setFilter(f)}
                icon={
                  f === "all"
                    ? undefined
                    : ({ size }) => (
                        <View
                          style={{ width: size * 0.5, height: size * 0.5, borderRadius: size, backgroundColor: tableStatusColor(theme, f) }}
                        />
                      )
                }
              >
                {f === "all" ? `All (${all.length})` : TABLE_STATUS_LABEL[f]}
              </Chip>
            ))}
          </ScrollView>
        )}

        {all.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center", marginTop: 48 }}>
            No tables set up for this outlet yet.
          </Text>
        ) : (
          <FloorPlan
            tables={all}
            tickets={tickets.data ?? []}
            filter={filter}
            arranging={arranging}
            viewportWidth={width - SIDE_GUTTER * 2}
            onOpenTable={(table) => router.push({ pathname: `${basePath}/table/[id]`, params: { id: table.id } })}
            onMoveTable={(tableId, position) =>
              moveTable.mutate({ tableId, position }, { onError: (e) => setMessage(getErrorMessage(e)) })
            }
            onDragChange={setDragging}
          />
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={confirmReset} onDismiss={() => setConfirmReset(false)} style={{ backgroundColor: theme.colors.surface }}>
          <Dialog.Title>Reset table layout?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Every table goes back to a neat grid, 6 per row. This also changes the floor plan on the web POS.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmReset(false)} disabled={resetLayout.isPending}>
              Cancel
            </Button>
            <Button onPress={doReset} loading={resetLayout.isPending} disabled={resetLayout.isPending}>
              Reset layout
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!message} onDismiss={() => setMessage(null)} duration={3000}>
        {message ?? ""}
      </Snackbar>
    </View>
  );
}