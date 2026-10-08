import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Dialog, Divider, Portal, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useSetKotItemStatus, useSetKotTicketStatus } from "../../hooks/useKot";
import { useCancelOrder } from "../../hooks/useOrder";
import { useTableBill, type BillItem } from "../../hooks/usePayment";
import { formatRs, KOT_STATUS_LABEL, kitchenStateByOrderItem, orderItemName, roundMoney, toNumber } from "../../lib/pos";
import { useAppTheme } from "../../theme/paperTheme";
import { kotStatusColor } from "../../theme/statusColors";
import type { DiningTable, KotStatus, KotTicket, OrderItem, TableOrder } from "../../types/pos";
import ItemPaymentSheet from "../payment/ItemPaymentSheet";
import TablePaymentSheet from "../payment/TablePaymentSheet";
import StatusPill from "../StatusPill";

type TableOrderListProps = {
  table: DiningTable;
  orders: TableOrder[];
  tickets: KotTicket[];
  onMessage: (message: string) => void;
  /** After the whole table is paid and set to Cleaning. */
  onTableClosed: () => void;
};

type ItemKitchen = { status: KotStatus; kotItemId?: string; ticketId?: string };

const PROGRESS: Record<KotStatus, number> = { cancelled: -1, pending: 0, preparing: 1, ready: 2, served: 3 };

/** Open orders on a table: kitchen status, deliver/undo, pay per item, pay the bill, cancel order. */
export default function TableOrderList({ table, orders, tickets, onMessage, onTableClosed }: TableOrderListProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { hasPermission } = useAuth();
  const kitchen = kitchenStateByOrderItem(tickets);
  const ticketStatus = new Map(tickets.map((t) => [t.id, t.status]));
  const bill = useTableBill(orders);

  const setItemStatus = useSetKotItemStatus();
  const setTicketStatus = useSetKotTicketStatus();
  const cancelOrder = useCancelOrder();
  const [confirmCancel, setConfirmCancel] = useState<TableOrder | null>(null);
  const [payingItem, setPayingItem] = useState<BillItem | null>(null);
  const [payingTable, setPayingTable] = useState(false);

  /**
   * Item status from the live ticket list. If the kitchen moved the whole ticket ahead
   * (e.g. "ready"), the items keep their old status — so show the ticket's status and
   * act on the ticket (the server won't let an item jump pending → served).
   * Falls back to the order's ticket once the ticket is closed.
   */
  const itemKitchen = (order: TableOrder, item: OrderItem): ItemKitchen => {
    const live = kitchen.get(item.id);
    if (live) {
      const ticket = ticketStatus.get(live.ticketId);
      if (ticket && live.status !== "cancelled" && PROGRESS[ticket] > PROGRESS[live.status]) {
        return { status: ticket, ticketId: live.ticketId };
      }
      return live;
    }
    const ticket = order.kotTickets.find((t) => t.status !== "cancelled") ?? order.kotTickets[0];
    return { status: ticket?.status ?? "pending", ticketId: ticket?.id };
  };

  const changeItem = (state: ItemKitchen, next: "ready" | "served") => {
    const onError = (e: unknown) => onMessage(getErrorMessage(e));
    if (state.kotItemId) {
      setItemStatus.mutate({ kotItemId: state.kotItemId, status: next }, { onError });
    } else if (state.ticketId) {
      // Ticket closed, or the kitchen moved the whole ticket → update the ticket like the web.
      setTicketStatus.mutate({ ticketId: state.ticketId, status: next }, { onError });
    }
  };

  const isChanging = (state: ItemKitchen) =>
    (setItemStatus.isPending && setItemStatus.variables?.kotItemId === state.kotItemId && !!state.kotItemId) ||
    (setTicketStatus.isPending && setTicketStatus.variables?.ticketId === state.ticketId && !state.kotItemId);

  const tableTotal = roundMoney(orders.reduce((sum, o) => sum + toNumber(o.total), 0));
  const canCancel = hasPermission("pos.billing.update");
  const canServe = hasPermission("restaurant.kot.update");
  const canPay = hasPermission("pos.payments.create");

  // Like the web: the full bill can be taken once every item has been delivered.
  const kitchenStates = orders.flatMap((o) => o.items.map((i) => itemKitchen(o, i).status)).filter((s) => s !== "cancelled");
  const allDelivered = kitchenStates.length > 0 && kitchenStates.every((s) => s === "served");

  return (
    <View className="flex-1">
      {orders.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
            No open orders on this table.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="gap-3 p-4 pb-8">
          {orders.map((order) => (
            <Card key={order.id} mode="outlined" style={{ backgroundColor: theme.colors.surface }}>
              <View className="gap-3 p-4">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: "700" }}>
                      Order #{order.orderNumber}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {order.customerName ? ` · ${order.customerName}` : ""}
                    </Text>
                  </View>
                  {canCancel ? (
                    <Button compact textColor={theme.colors.error} onPress={() => setConfirmCancel(order)}>
                      Cancel
                    </Button>
                  ) : null}
                </View>

                <Divider />

                {order.items.map((item) => {
                  const state = itemKitchen(order, item);
                  const billItem = bill.items.get(item.id);
                  const paidQty = billItem?.paidQty ?? 0;
                  const fullyPaid = !!billItem && billItem.unpaidQty <= 0;
                  const canPayItem =
                    canPay && !bill.loading && !!billItem && !fullyPaid && (state.status === "ready" || state.status === "served");

                  return (
                    <View key={item.id} className="flex-row items-center gap-3">
                      <View className="flex-1 gap-1">
                        <Text
                          variant="bodyLarge"
                          style={{
                            color: theme.colors.onSurface,
                            textDecorationLine: fullyPaid ? "line-through" : "none",
                            opacity: fullyPaid ? 0.6 : 1,
                          }}
                        >
                          {item.quantity} × {orderItemName(item)}
                        </Text>
                        {item.notes ? (
                          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, fontStyle: "italic" }}>
                            “{item.notes}”
                          </Text>
                        ) : null}
                        <View className="flex-row flex-wrap gap-2">
                          <StatusPill label={KOT_STATUS_LABEL[state.status]} color={kotStatusColor(theme, state.status)} />
                          {paidQty > 0 ? (
                            <StatusPill label={fullyPaid ? "Paid" : `${paidQty} of ${item.quantity} paid`} color={theme.colors.success} />
                          ) : null}
                        </View>
                      </View>

                      <View className="items-end gap-1">
                        {canServe && state.status === "ready" ? (
                          <Button
                            mode="contained"
                            compact
                            icon="check"
                            loading={isChanging(state)}
                            disabled={isChanging(state)}
                            onPress={() => changeItem(state, "served")}
                          >
                            Deliver
                          </Button>
                        ) : null}
                        {canServe && state.status === "served" ? (
                          <Button compact loading={isChanging(state)} disabled={isChanging(state)} onPress={() => changeItem(state, "ready")}>
                            Undo
                          </Button>
                        ) : null}
                        {canPayItem ? (
                          <Button compact mode="outlined" icon="cash" onPress={() => setPayingItem(billItem)}>
                            Pay
                          </Button>
                        ) : null}
                      </View>
                    </View>
                  );
                })}

                <Divider />

                <View className="gap-1">
                  <Line label="Subtotal" value={formatRs(order.subtotal)} />
                  <Line label={`Tax (${toNumber(order.taxRate)}%)`} value={formatRs(order.taxAmount)} />
                  <Line label="Total" value={formatRs(order.total)} bold />
                </View>
              </View>
            </Card>
          ))}

          {orders.length > 1 ? (
            <View className="flex-row justify-between px-1">
              <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
                Table total
              </Text>
              <Text variant="titleMedium" style={{ color: theme.colors.onBackground, fontWeight: "700" }}>
                {formatRs(tableTotal)}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {canPay && orders.length > 0 ? (
        <View
          className="gap-1 px-4 pt-3"
          style={{
            paddingBottom: insets.bottom + 12,
            backgroundColor: theme.colors.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.colors.outlineVariant,
          }}
        >
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Balance due
              </Text>
              <Text variant="titleLarge" style={{ color: theme.colors.onSurface, fontWeight: "800" }}>
                {bill.loading ? "…" : formatRs(bill.totalDue)}
              </Text>
            </View>
            <Button
              mode="contained"
              icon="cash-register"
              disabled={!allDelivered || bill.loading}
              onPress={() => setPayingTable(true)}
              contentStyle={{ height: 48 }}
            >
              Pay bill
            </Button>
          </View>
          {!allDelivered ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Deliver every item before taking the full payment.
            </Text>
          ) : null}
        </View>
      ) : null}

      <ItemPaymentSheet
        item={payingItem}
        onDismiss={() => setPayingItem(null)}
        onPaid={(message, orderFullyPaid) => {
          onMessage(message);
          // Paying item by item doesn't free the table on the server. If nothing is
          // owed on the table any more, offer "Close table" straight away.
          const othersOwe = bill.dues.some((d) => d.orderId !== payingItem?.orderId);
          if (orderFullyPaid && !othersOwe) setPayingTable(true);
        }}
      />

      <TablePaymentSheet
        visible={payingTable}
        onDismiss={() => setPayingTable(false)}
        table={table}
        bill={bill}
        onTableClosed={() => {
          setPayingTable(false);
          onTableClosed();
        }}
      />

      <Portal>
        <Dialog visible={!!confirmCancel} onDismiss={() => setConfirmCancel(null)} style={{ backgroundColor: theme.colors.surface }}>
          <Dialog.Title>Cancel order #{confirmCancel?.orderNumber}?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              The kitchen ticket is cancelled too. This can't be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmCancel(null)}>Keep</Button>
            <Button
              textColor={theme.colors.error}
              loading={cancelOrder.isPending}
              disabled={cancelOrder.isPending}
              onPress={() => {
                if (!confirmCancel) return;
                const { id, orderNumber } = confirmCancel;
                cancelOrder.mutate(id, {
                  onSuccess: () => onMessage(`Order #${orderNumber} cancelled`),
                  onError: (e) => onMessage(getErrorMessage(e)),
                  onSettled: () => setConfirmCancel(null),
                });
              }}
            >
              Cancel order
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
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