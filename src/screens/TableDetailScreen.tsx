import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import {
  ActivityIndicator,
  Chip,
  SegmentedButtons,
  Snackbar,
  Text,
} from "react-native-paper";

import { getErrorMessage } from "../api/client";
import OrderBuilder from "../components/order/OrderBuilder";
import TableOrderList from "../components/order/TableOrderList";
import StatusPill from "../components/StatusPill";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../hooks/useCart";
import { useKotTickets } from "../hooks/useKot";
import { useCreateDineInOrder, useTableOrders } from "../hooks/useOrder";
import { useSetTableStatus, useTables } from "../hooks/useTables";
import { TABLE_STATUS_LABEL } from "../lib/pos";
import { useAppTheme } from "../theme/paperTheme";
import { tableStatusColor } from "../theme/statusColors";
import type { TableStatus } from "../types/pos";

type Tab = "menu" | "orders";

/** Statuses staff can set by hand. "Occupied" is set by the server when an order is placed. */
const MANUAL_STATUSES: TableStatus[] = ["available", "reserved", "dirty"];

/** One table: change its status, add an order, see and serve its open orders. */
export default function TableDetailScreen() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tableId = id ?? null;
  const { hasPermission } = useAuth();

  const tables = useTables();
  const table = tables.data?.find((t) => t.id === tableId);
  const tableOrders = useTableOrders(tableId);
  const tickets = useKotTickets();
  const orders = tableOrders.data?.orders ?? [];

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
      <View className="flex-1 items-center justify-center bg-background">
        <Stack.Screen options={{ title }} />
        <ActivityIndicator size="large" />
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

  const hasOpenOrders = orders.length > 0;
  const canSetStatus = hasPermission("restaurant.tables.update");
  const canOrder = hasPermission("pos.billing.create");

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title }} />

      <View className="gap-3 px-4 pb-3">
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

        {canSetStatus ? (
          <View className="gap-1">
            <View className="flex-row flex-wrap gap-2">
              {MANUAL_STATUSES.map((s) => (
                <Chip
                  key={s}
                  compact
                  selected={table.status === s}
                  showSelectedCheck={false}
                  mode={table.status === s ? "flat" : "outlined"}
                  disabled={hasOpenOrders || setStatus.isPending}
                  onPress={() => changeStatus(s)}
                >
                  {TABLE_STATUS_LABEL[s]}
                </Chip>
              ))}
            </View>
            {hasOpenOrders ? (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Status is locked while the table has open orders.
              </Text>
            ) : null}
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
      ) : tableOrders.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        // <TableOrderList orders={orders} tickets={tickets.data ?? []} onMessage={setMessage} />
        <TableOrderList
          table={table}
          orders={orders}
          tickets={tickets.data ?? []}
          onMessage={setMessage}
          onTableClosed={() => router.back()}
        />
      )}

      <Snackbar
        visible={!!message}
        onDismiss={() => setMessage(null)}
        duration={3500}
      >
        {message ?? ""}
      </Snackbar>
    </View>
  );
}
