import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Pressable, View } from "react-native";
import {
  Chip,
  SegmentedButtons,
  Snackbar,
  Text,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../api/client";
import MaxWidth from "../components/MaxWidth";
import OrderBuilder from "../components/order/OrderBuilder";
import TableOrderList from "../components/order/TableOrderList";
import { ListSkeleton, TableHeaderSkeleton } from "../components/Skeleton";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../hooks/useCart";
import { useKotTickets } from "../hooks/useKot";
import { useLayout } from "../hooks/useLayout";
import { useCreateDineInOrder, useTableOrders } from "../hooks/useOrder";
import { useTableBill } from "../hooks/usePayment";
import { useSetTableStatus, useTables } from "../hooks/useTables";
import { TABLE_STATUS_LABEL } from "../lib/pos";
import { useAppTheme } from "../theme/paperTheme";
import { tableStatusColor } from "../theme/statusColors";
import { useWebPalette, type WebPalette } from "../theme/webPalette";
import type { TableStatus } from "../types/pos";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/** "Add order" (menu) or "Orders" — the two tabs, on phones and on wide screens. */
type Tab = "menu" | "orders";

/** Same four buttons as the web table screen. */
const STATUSES: TableStatus[] = ["available", "occupied", "reserved", "dirty"];

/**
 * One table: change its status, add an order, see and serve its open orders.
 * Phone: "Add order" / "Orders" tabs. Landscape / tablet: like the web table screen —
 * header with tabs and status, menu grid + "Active Order" sidebar, or the order list.
 */
export default function TableDetailScreen() {
  const theme = useAppTheme();
  const web = useWebPalette();
  const insets = useSafeAreaInsets();
  const { isWide } = useLayout();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tableId = id ?? null;
  const { hasPermission } = useAuth();

  const tables = useTables();
  const table = tables.data?.find((t) => t.id === tableId);
  const tableOrders = useTableOrders(tableId);
  const tickets = useKotTickets();
  const orders = tableOrders.data?.orders ?? [];
  const bill = useTableBill(orders);

  const cart = useCart();
  const createOrder = useCreateDineInOrder();
  const setStatus = useSetTableStatus();

  const [tab, setTab] = useState<Tab>("menu");
  const [message, setMessage] = useState<string | null>(null);

  // Open on "Orders" if the table already has orders (first load only).
  const openedOnOrders = useRef(false);
  useEffect(() => {
    if (!openedOnOrders.current && tableOrders.data) {
      openedOnOrders.current = true;
      if (tableOrders.data.orders.length > 0) setTab("orders");
    }
  }, [tableOrders.data]);

  const handleSubmit = async (customer: {
    customerName?: string;
    customerPhone?: string;
  }) => {
    if (!tableId) return false;
    try {
      const result = await createOrder.mutateAsync({
        tableId,
        ...customer,
        items: cart.toOrderItems(),
      });
      cart.clear();
      setMessage(`Order #${result.order.orderNumber} sent to the kitchen`);
      setTab("orders");
      return true;
    } catch (error) {
      setMessage(getErrorMessage(error));
      return false;
    }
  };

  const changeStatus = (status: TableStatus) => {
    if (!tableId || status === table?.status) return;
    setStatus.mutate(
      { tableId, status },
      { onError: (error) => setMessage(getErrorMessage(error)) },
    );
  };

  const title = table ? `Table ${table.tableNumber}` : "Table";

  if (tables.isLoading) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ title }} />
        <TableHeaderSkeleton />
        <ListSkeleton rows={5} />
      </View>
    );
  }

  if (!table) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Stack.Screen options={{ title }} />
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}
        >
          This table no longer exists.
        </Text>
      </View>
    );
  }

  // Like the web: only "Cleaning" is blocked, and only while the table still owes money.
  const owesMoney = orders.length > 0 && (bill.loading || bill.totalDue > 0);
  const canSetStatus = hasPermission("restaurant.tables.update");
  const canOrder = hasPermission("pos.billing.create");

  const statusChips = canSetStatus ? (
    <View className="flex-row flex-wrap gap-2">
      {STATUSES.map((s) => (
        <Chip
          key={s}
          compact
          selected={table.status === s}
          showSelectedCheck={false}
          mode={table.status === s ? "flat" : "outlined"}
          disabled={setStatus.isPending || (s === "dirty" && owesMoney)}
          onPress={() => changeStatus(s)}
        >
          {TABLE_STATUS_LABEL[s]}
        </Chip>
      ))}
    </View>
  ) : null;

  const cleaningNote =
    canSetStatus && owesMoney ? (
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        Settle the bill before marking the table for cleaning.
      </Text>
    ) : null;

  const statusInfo = (
    <View className="flex-row items-center gap-3">
      <StatusPill
        label={TABLE_STATUS_LABEL[table.status]}
        color={tableStatusColor(theme, table.status)}
      />
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {table.capacity} seats
      </Text>
    </View>
  );

  const ordersView = tableOrders.isLoading ? (
    <ListSkeleton rows={4} thumbnail={false} />
  ) : (
    <TableOrderList
      table={table}
      orders={orders}
      tickets={tickets.data ?? []}
      onMessage={setMessage}
      onTableClosed={() => router.back()}
    />
  );

  const snackbar = (
    <Snackbar
      visible={!!message}
      onDismiss={() => setMessage(null)}
      duration={3500}
    >
      {message ?? ""}
    </Snackbar>
  );

  // ── Landscape / tablet: like the web table screen ──
  if (isWide) {
    const header = web.header;
    return (
      <View className="flex-1" style={{ backgroundColor: web.pageBg }}>
        <Stack.Screen options={{ title }} />

        {/* Web header: "Add Order | Order List" tabs on the left, table status on the right. */}
        <View
          className="flex-row flex-wrap items-end justify-between gap-x-4"
          style={{
            backgroundColor: header.bg,
            borderBottomWidth: 1,
            borderColor: header.border,
            paddingLeft: insets.left + 8,
            paddingRight: insets.right + 12,
            paddingTop: 6,
          }}
        >
          <View className="flex-row">
            <HeaderTab
              web={web}
              icon="plus"
              label="Add Order"
              active={tab === "menu" && canOrder}
              disabled={!canOrder}
              onPress={() => setTab("menu")}
            />
            <HeaderTab
              web={web}
              icon="clipboard-check-outline"
              label="Order List"
              count={orders.length}
              active={tab === "orders" || !canOrder}
              onPress={() => setTab("orders")}
            />
          </View>

          <View className="flex-row items-center gap-3 pb-2">
            <Text style={{ color: header.tab, fontSize: 12, fontWeight: "600" }}>
              {table.capacity} seats
            </Text>
            {canSetStatus ? (
              <View
                className="flex-row gap-1 rounded-xl p-1"
                style={{ backgroundColor: header.groupBg, borderWidth: 1, borderColor: header.groupBorder }}
              >
                {STATUSES.map((s) => {
                  const selected = table.status === s;
                  const blocked = s === "dirty" && owesMoney;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => changeStatus(s)}
                      disabled={setStatus.isPending || blocked}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: blocked }}
                      accessibilityHint={blocked ? "Settle the bill before cleaning" : undefined}
                      className="rounded-lg px-3 py-1.5 active:opacity-70"
                      style={{
                        backgroundColor: selected ? header.optionActiveBg : "transparent",
                        opacity: blocked && !selected ? 0.4 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? header.optionActive : header.option,
                          fontSize: 12,
                          fontWeight: "600",
                          letterSpacing: 0.5,
                        }}
                      >
                        {TABLE_STATUS_LABEL[s].toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <StatusPill
                label={TABLE_STATUS_LABEL[table.status]}
                color={tableStatusColor(theme, table.status)}
              />
            )}
          </View>
        </View>

        {tab === "menu" && canOrder ? (
          <OrderBuilder
            cart={cart}
            submitLabel="Place Order"
            submitIcon="plus"
            submitting={createOrder.isPending}
            onSubmit={handleSubmit}
            onMessage={setMessage}
          />
        ) : (
          <View
            className="flex-1"
            style={{ paddingLeft: insets.left, paddingRight: insets.right }}
          >
            {cleaningNote ? (
              <View className="items-center px-4 pt-3">{cleaningNote}</View>
            ) : null}
            <MaxWidth width={900} style={{ flex: 1 }}>
              {ordersView}
            </MaxWidth>
          </View>
        )}

        {snackbar}
      </View>
    );
  }

  // ── Phone (portrait) ──
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title }} />

      <View className="gap-3 px-4 pb-3">
        {statusInfo}

        {canSetStatus ? (
          <View className="gap-1">
            {statusChips}
            {cleaningNote}
          </View>
        ) : null}

        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          buttons={[
            {
              value: "menu",
              label: "Add order",
              icon: "plus",
              disabled: !canOrder,
            },
            {
              value: "orders",
              label: `Orders (${orders.length})`,
              icon: "clipboard-list-outline",
            },
          ]}
        />
      </View>

      {tab === "menu" && canOrder ? (
        <OrderBuilder
          cart={cart}
          submitLabel="Send to kitchen"
          submitIcon="chef-hat"
          submitting={createOrder.isPending}
          onSubmit={handleSubmit}
          onMessage={setMessage}
        />
      ) : (
        ordersView
      )}

      {snackbar}
    </View>
  );
}
type HeaderTabProps = {
  web: WebPalette;
  icon: IconName;
  label: string;
  count?: number;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/** Web-style tab: underlined when active, with an order count badge. */
function HeaderTab({ web, icon, label, count, active, disabled, onPress }: HeaderTabProps) {
  const header = web.header;
  const color = active ? header.tabActive : header.tab;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="tab"
      accessibilityState={{ selected: active, disabled }}
      className="flex-row items-center gap-1.5 px-4 py-2.5 active:opacity-70"
      style={{
        borderBottomWidth: 2,
        borderColor: active ? header.tabActive : "transparent",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      <Text style={{ color, fontSize: 14, fontWeight: "600" }}>{label}</Text>
      {count ? (
        <View
          className="ml-1 h-5 items-center justify-center rounded-full px-1.5"
          style={{ minWidth: 20, backgroundColor: header.badgeBg }}
        >
          <Text style={{ color: header.badgeText, fontSize: 10, fontWeight: "700" }}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
