import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Button, Card, HelperText, Text } from "react-native-paper";

import { getErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useKotTickets, useSetKotTicketStatus } from "../hooks/useKot";
import { orderItemName, readyTakeaways } from "../lib/pos";
import { useAppTheme } from "../theme/paperTheme";
import BottomSheet from "./payment/BottomSheet";

/**
 * Takeaway orders the kitchen has finished (web: "Takeaway Pickup Queue").
 * Shows nothing when the queue is empty. "Picked up" closes the ticket.
 */
export default function PickupQueue() {
  const theme = useAppTheme();
  const { hasPermission } = useAuth();
  const tickets = useKotTickets();
  const setTicketStatus = useSetKotTicketStatus();

  const [open, setOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = readyTakeaways(tickets.data ?? []);
  if (ready.length === 0) return null;

  const canUpdate = hasPermission("restaurant.kot.update");
  const close = () => {
    setOpen(false);
    setConfirmingId(null);
    setError(null);
  };

  const pickUp = (ticketId: string) => {
    setError(null);
    setTicketStatus.mutate(
      { ticketId, status: "served" },
      {
        onSuccess: () => setConfirmingId(null),
        onError: (e) => setError(getErrorMessage(e)),
      },
    );
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className="flex-row items-center gap-3 rounded-xl px-4 py-3 active:opacity-70"
        style={{ backgroundColor: `${theme.colors.success}1f`, borderWidth: 1, borderColor: `${theme.colors.success}66` }}
      >
        <MaterialCommunityIcons name="shopping-outline" size={22} color={theme.colors.success} />
        <Text variant="titleSmall" style={{ flex: 1, color: theme.colors.onSurface, fontWeight: "700" }}>
          {ready.length} takeaway{ready.length === 1 ? "" : "s"} ready for pickup
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
      </Pressable>

      <BottomSheet
        visible={open}
        onDismiss={close}
        title="Ready for pickup"
        subtitle="Hand the order over, then mark it picked up."
      >
        <ScrollView style={{ flexShrink: 1 }} contentContainerClassName="gap-3 px-4 pb-2">
          {error ? <HelperText type="error" padding="none">{error}</HelperText> : null}
          {ready.map((ticket) => {
            const confirming = confirmingId === ticket.id;
            const saving = setTicketStatus.isPending && setTicketStatus.variables?.ticketId === ticket.id;
            return (
              <Card key={ticket.id} mode="outlined" style={{ backgroundColor: theme.colors.surface }}>
                <View className="gap-2 p-4">
                  <View className="flex-row items-center justify-between">
                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: "700" }}>
                      #{ticket.order.orderNumber}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {ticket.order.customerName ?? "Walk-in"} ·{" "}
                      {new Date(ticket.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  {ticket.items.map((i) => (
                    <Text key={i.id} variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                      {i.orderItem.quantity} × {orderItemName(i.orderItem)}
                    </Text>
                  ))}

                  {canUpdate ? (
                    confirming ? (
                      <View className="flex-row justify-end gap-2">
                        <Button disabled={saving} onPress={() => setConfirmingId(null)}>
                          Back
                        </Button>
                        <Button mode="contained" icon="check" loading={saving} disabled={saving} onPress={() => pickUp(ticket.id)}>
                          Confirm picked up
                        </Button>
                      </View>
                    ) : (
                      <Button mode="contained-tonal" icon="hand-extended-outline" onPress={() => setConfirmingId(ticket.id)}>
                        Picked up
                      </Button>
                    )
                  ) : null}
                </View>
              </Card>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </>
  );
}