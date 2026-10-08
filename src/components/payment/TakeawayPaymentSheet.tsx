import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Divider, HelperText, Text } from "react-native-paper";

import { getErrorMessage } from "../../api/client";
import type { Cart } from "../../hooks/useCart";
import { useOutlet } from "../../hooks/useMenu";
import { useCreateTakeawayOrder } from "../../hooks/useOrder";
import { formatRs, outletTaxRate, PAYMENT_METHOD_LABEL, resolveTender, serverTotals } from "../../lib/pos";
import { useAppTheme } from "../../theme/paperTheme";
import type { PaymentMethod } from "../../types/pos";
import BottomSheet from "./BottomSheet";
import PaymentMethodPicker from "./PaymentMethodPicker";
import PaymentSuccess, { type SuccessRow } from "./PaymentSuccess";
import SummaryRow from "./SummaryRow";
import TenderInput from "./TenderInput";

type TakeawayPaymentSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  cart: Cart;
  customer: { customerName?: string; customerPhone?: string };
};

type Receipt = { orderNumber: number; rows: SuccessRow[] };

/** Take payment for the cart and place the takeaway order in one go (POST /orders/takeaway). */
export default function TakeawayPaymentSheet({ visible, onDismiss, cart, customer }: TakeawayPaymentSheetProps) {
  const theme = useAppTheme();
  const outlet = useOutlet();
  const createOrder = useCreateTakeawayOrder();

  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amountText, setAmountText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    if (visible) {
      setMethod("cash");
      setAmountText("");
      setError(null);
      setReceipt(null);
    }
  }, [visible]);

  const taxRate = outletTaxRate(outlet.data);
  const totals = serverTotals(cart.subtotal, taxRate);
  const tender = resolveTender(method, totals.total, amountText);
  const taxLoading = outlet.isLoading;

  const pay = async () => {
    if (tender.amount === null || tender.error) return;
    setError(null);
    const tendered = tender.amount;
    try {
      const result = await createOrder.mutateAsync({
        customerName: customer.customerName,
        customerPhone: customer.customerPhone,
        items: cart.toOrderItems(),
        payment: { method, amountTendered: tendered },
      });

      const rows: SuccessRow[] = [
        { label: "Total", value: formatRs(result.total), tone: "total" },
        { label: "Method", value: PAYMENT_METHOD_LABEL[method] },
      ];
      if (method === "cash") {
        rows.push({ label: "Cash received", value: formatRs(tendered) });
        rows.push({ label: "Change to return", value: formatRs(result.changeDue), tone: "success" });
      }
      if (customer.customerName) rows.push({ label: "Customer", value: customer.customerName, tone: "muted" });

      cart.clear();
      setReceipt({ orderNumber: result.order.orderNumber, rows });
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      dismissable={!createOrder.isPending}
      title={receipt ? "Takeaway" : "Takeaway payment"}
      subtitle={receipt ? undefined : "Payment places the order and sends it to the kitchen"}
    >
      {receipt ? (
        <PaymentSuccess
          title={`Order #${receipt.orderNumber} paid`}
          subtitle="Sent to the kitchen. It shows under “Ready for pickup” when done."
          rows={receipt.rows}
          doneLabel="New order"
          onDone={onDismiss}
        />
      ) : (
        <>
          <ScrollView style={{ flexShrink: 1 }} contentContainerClassName="gap-4 px-4 pb-4" keyboardShouldPersistTaps="handled">
            <View className="gap-1">
              {cart.lines.map((line) => (
                <SummaryRow
                  key={line.key}
                  label={`${line.quantity} × ${line.name}${line.variantLabel ? ` (${line.variantLabel})` : ""}`}
                  value={formatRs(line.unitPrice * line.quantity)}
                />
              ))}
              <Divider style={{ marginVertical: 6 }} />
              <SummaryRow label="Subtotal" value={formatRs(totals.subtotal)} />
              <SummaryRow
                label={`${outlet.data?.taxName ?? "Tax"} (${taxLoading ? "…" : `${taxRate}%`})`}
                value={formatRs(totals.tax)}
              />
              <SummaryRow label="Total due" value={formatRs(totals.total)} tone="total" />
              {customer.customerName || customer.customerPhone ? (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                  Customer: {[customer.customerName, customer.customerPhone].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
            </View>

            <PaymentMethodPicker
              value={method}
              onChange={(m) => {
                setMethod(m);
                setAmountText("");
              }}
              disabled={createOrder.isPending}
            />

            <TenderInput
              method={method}
              due={totals.total}
              value={amountText}
              onChange={setAmountText}
              tender={tender}
              disabled={createOrder.isPending}
            />

            {error ? <HelperText type="error" padding="none">{error}</HelperText> : null}
          </ScrollView>

          <View className="px-4">
            <Button
              mode="contained"
              icon="check"
              onPress={pay}
              loading={createOrder.isPending}
              disabled={createOrder.isPending || taxLoading || cart.lines.length === 0 || tender.amount === null || !!tender.error}
              contentStyle={{ height: 52 }}
            >
              {`Confirm payment · ${formatRs(method === "cash" || tender.amount === null ? totals.total : tender.amount)}`}
            </Button>
          </View>
        </>
      )}
    </BottomSheet>
  );
}