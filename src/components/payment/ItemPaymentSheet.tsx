import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, HelperText, IconButton, Text } from "react-native-paper";

import { getErrorMessage } from "../../api/client";
import { usePayPartial, type BillItem } from "../../hooks/usePayment";
import { formatRs, IN_PERSON_METHODS, serverTotals } from "../../lib/pos";
import { useAppTheme } from "../../theme/paperTheme";
import type { PaymentMethod } from "../../types/pos";
import BottomSheet from "./BottomSheet";
import PaymentMethodPicker from "./PaymentMethodPicker";
import SummaryRow from "./SummaryRow";

type ItemPaymentSheetProps = {
  /** The item to pay for; null = closed. */
  item: BillItem | null;
  onDismiss: () => void;
  /** orderFullyPaid: this payment settled the last unpaid item of its order. */
  onPaid: (message: string, orderFullyPaid: boolean) => void;
};

/** Pay for some units of one item (web: "Pay item"). Cash / card / QR, exact amount. */
export default function ItemPaymentSheet({ item, onDismiss, onPaid }: ItemPaymentSheetProps) {
  const theme = useAppTheme();
  const payPartial = usePayPartial();

  const [quantity, setQuantity] = useState(1);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [error, setError] = useState<string | null>(null);

  // Fresh form for each item (not on every 5 s refresh of the same item).
  const itemId = item?.orderItemId;
  useEffect(() => {
    if (itemId) {
      setQuantity(1);
      setMethod("cash");
      setError(null);
    }
  }, [itemId]);

  const maxQty = item?.unpaidQty ?? 1;
  const totals = serverTotals((item?.unitPrice ?? 0) * quantity, item?.taxRate ?? 0);

  const pay = async () => {
    if (!item) return;
    setError(null);
    try {
      const result = await payPartial.mutateAsync({
        orderId: item.orderId,
        method,
        items: [{ orderItemId: item.orderItemId, quantity }],
        amountTendered: totals.total, // same rounding as the server → never "insufficient"
      });
      onPaid(`Paid ${formatRs(totals.total)} for ${quantity} × ${item.name}`, result.orderFullyPaid);
      onDismiss();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <BottomSheet
      visible={!!item}
      onDismiss={onDismiss}
      dismissable={!payPartial.isPending}
      title="Pay for item"
      subtitle={item?.name}
    >
      <View className="gap-4 px-4 pb-2">
        <View className="gap-1">
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            Quantity ({maxQty} unpaid)
          </Text>
          <View className="flex-row items-center gap-3">
            <IconButton
              icon="minus"
              mode="outlined"
              disabled={quantity <= 1 || payPartial.isPending}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              accessibilityLabel="One less"
            />
            <Text variant="headlineSmall" style={{ minWidth: 40, textAlign: "center", color: theme.colors.onSurface, fontWeight: "700" }}>
              {quantity}
            </Text>
            <IconButton
              icon="plus"
              mode="outlined"
              disabled={quantity >= maxQty || payPartial.isPending}
              onPress={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              accessibilityLabel="One more"
            />
            {maxQty > 1 ? (
              <Button compact disabled={payPartial.isPending} onPress={() => setQuantity(maxQty)}>
                All
              </Button>
            ) : null}
          </View>
        </View>

        <PaymentMethodPicker value={method} onChange={setMethod} methods={IN_PERSON_METHODS} disabled={payPartial.isPending} />

        <View className="gap-1 rounded-xl p-3" style={{ backgroundColor: theme.colors.surfaceVariant }}>
          <SummaryRow label="Subtotal" value={formatRs(totals.subtotal)} />
          <SummaryRow label={`Tax (${item?.taxRate ?? 0}%)`} value={formatRs(totals.tax)} />
          <SummaryRow label="Total due" value={formatRs(totals.total)} tone="total" />
        </View>

        {error ? <HelperText type="error" padding="none">{error}</HelperText> : null}

        <Button
          mode="contained"
          icon="check"
          onPress={pay}
          loading={payPartial.isPending}
          disabled={payPartial.isPending || !item}
          contentStyle={{ height: 52 }}
        >
          {`Confirm payment · ${formatRs(totals.total)}`}
        </Button>
      </View>
    </BottomSheet>
  );
}