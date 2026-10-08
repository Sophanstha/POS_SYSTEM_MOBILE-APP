import { ScrollView, View } from "react-native";
import { Button, Divider, IconButton, Modal, Portal, Text, TextInput } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Cart } from "../../hooks/useCart";
import { useOutlet } from "../../hooks/useMenu";
import { calcTotals, formatRs, outletTaxRate } from "../../lib/pos";
import { useAppTheme } from "../../theme/paperTheme";

export type CustomerDetails = { customerName: string; customerPhone: string };

type CartSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  cart: Cart;
  customer: CustomerDetails;
  onCustomerChange: (next: CustomerDetails) => void;
  submitLabel: string;
  submitIcon: string;
  submitting: boolean;
  onSubmit: () => void;
};

/** The order being built: lines, notes, customer, totals preview, submit. */
export default function CartSheet({
  visible,
  onDismiss,
  cart,
  customer,
  onCustomerChange,
  submitLabel,
  submitIcon,
  submitting,
  onSubmit,
}: CartSheetProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const outlet = useOutlet();
  const taxRate = outletTaxRate(outlet.data);
  const totals = calcTotals(cart.subtotal, taxRate);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={{
          backgroundColor: theme.colors.surface,
          marginTop: "auto",
          maxHeight: "90%",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingBottom: insets.bottom + 12,
        }}
      >
        <View className="flex-row items-center justify-between px-4 pt-3">
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface, fontWeight: "700" }}>
            Current order
          </Text>
          <View className="flex-row items-center">
            {cart.lines.length > 0 ? (
              <Button compact textColor={theme.colors.error} onPress={cart.clear}>
                Clear
              </Button>
            ) : null}
            <IconButton icon="close" onPress={onDismiss} accessibilityLabel="Close" />
          </View>
        </View>

        <ScrollView contentContainerClassName="gap-4 px-4 pb-4" keyboardShouldPersistTaps="handled">
          {cart.lines.length === 0 ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, paddingVertical: 24, textAlign: "center" }}>
              No items yet. Tap products on the menu to add them.
            </Text>
          ) : (
            cart.lines.map((line) => (
              <View key={line.key} className="gap-2">
                <View className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                      {line.name}
                      {line.variantLabel ? ` (${line.variantLabel})` : ""}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {formatRs(line.unitPrice)} × {line.quantity} = {formatRs(line.unitPrice * line.quantity)}
                    </Text>
                  </View>
                  <IconButton
                    icon="minus"
                    mode="outlined"
                    size={16}
                    onPress={() => cart.decrement(line.key)}
                    accessibilityLabel={`Remove one ${line.name}`}
                  />
                  <Text variant="titleMedium" style={{ minWidth: 20, textAlign: "center", color: theme.colors.onSurface }}>
                    {line.quantity}
                  </Text>
                  <IconButton
                    icon="plus"
                    mode="outlined"
                    size={16}
                    onPress={() => cart.increment(line.key)}
                    accessibilityLabel={`Add one ${line.name}`}
                  />
                </View>
                <TextInput
                  mode="outlined"
                  dense
                  placeholder="Note for the kitchen (optional)"
                  value={line.note}
                  onChangeText={(note) => cart.setNote(line.key, note)}
                  left={<TextInput.Icon icon="note-text-outline" />}
                />
              </View>
            ))
          )}

          <Divider />

          <View className="gap-2">
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              Customer (optional)
            </Text>
            <TextInput
              mode="outlined"
              dense
              label="Name"
              value={customer.customerName}
              onChangeText={(customerName) => onCustomerChange({ ...customer, customerName })}
            />
            <TextInput
              mode="outlined"
              dense
              label="Phone"
              keyboardType="phone-pad"
              value={customer.customerPhone}
              onChangeText={(customerPhone) => onCustomerChange({ ...customer, customerPhone })}
            />
          </View>

          <Divider />

          <View className="gap-1">
            <Row label="Subtotal" value={formatRs(totals.subtotal)} />
            <Row label={`${outlet.data?.taxName ?? "Tax"} (${taxRate}%)`} value={formatRs(totals.tax)} />
            <Row label="Total" value={formatRs(totals.total)} bold />
          </View>
        </ScrollView>

        <View className="px-4">
          <Button
            mode="contained"
            icon={submitIcon}
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting || cart.lines.length === 0}
            contentStyle={{ height: 52 }}
          >
            {submitLabel}
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const theme = useAppTheme();
  const style = { color: bold ? theme.colors.onSurface : theme.colors.onSurfaceVariant, fontWeight: bold ? ("700" as const) : undefined };

  return (
    <View className="flex-row justify-between">
      <Text variant={bold ? "titleMedium" : "bodyMedium"} style={style}>
        {label}
      </Text>
      <Text variant={bold ? "titleMedium" : "bodyMedium"} style={style}>
        {value}
      </Text>
    </View>
  );
}