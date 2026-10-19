import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Divider, HelperText, Text } from "react-native-paper";

import { getErrorMessage } from "../../../../shared/api/client";
import type { Cart } from "../../hooks/useCart";
import { useOutlet } from "../../hooks/useMenu";
import { useCreateTakeawayOrder } from "../../hooks/useOrder";
import {
  formatRs,
  outletTaxRate,
  PAYMENT_METHOD_LABEL,
  resolveTender,
  roundMoney,
  serverTotals,
  toNumber,
} from "../../lib/pos";
import { useAppTheme } from "../../../../shared/theme/paperTheme";
import type { PaymentMethod } from "../../types/pos";
import BottomSheet from "../../../../shared/components/BottomSheet";
import KeyboardAwareScrollView from "../../../../shared/components/KeyboardAwareScrollView";
import PaymentMethodPicker from "./PaymentMethodPicker";
import PaymentSuccess, { type SuccessRow } from "./PaymentSuccess";
import SummaryRow from "./SummaryRow";
import TenderInput from "./TenderInput";
import { ReceiptData, receiptHeader } from "../../lib/receipt";
import { usePosAuth } from "../../auth/PosAuthProvider";

type TakeawayPaymentSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  cart: Cart;
  customer: { customerName?: string; customerPhone?: string };
};

// type Receipt = { orderNumber: number; rows: SuccessRow[] };
type Receipt = { orderNumber: number; rows: SuccessRow[]; data: ReceiptData };
/** Take payment for the cart and place the takeaway order in one go (POST /orders/takeaway). */
export default function TakeawayPaymentSheet({
  visible,
  onDismiss,
  cart,
  customer,
}: TakeawayPaymentSheetProps) {
  const theme = useAppTheme();
  const outlet = useOutlet();
  const { activeOutlet } = usePosAuth();
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
        rows.push({
          label: "Change to return",
          value: formatRs(result.changeDue),
          tone: "success",
        });
      }
      if (customer.customerName)
        rows.push({
          label: "Customer",
          value: customer.customerName,
          tone: "muted",
        });

      // Receipt (built before the cart is cleared). Amounts are the server's.
      const grandTotal = toNumber(result.total);
      const subtotal = toNumber(result.subtotal);
      const tax = toNumber(result.tax.amount);
      const adjustment = roundMoney(grandTotal - subtotal - tax); // delivery-platform price
      const data: ReceiptData = {
        ...receiptHeader(outlet.data, activeOutlet?.name),
        date: new Date(),
        orderType: "Takeaway",
        orderNumbers: [result.order.orderNumber],
        customerName: customer.customerName,
        customerPhone: customer.customerPhone,
        sections: [
          {
            lines: cart.lines.map((line) => ({
              name: line.variantLabel
                ? `${line.name} (${line.variantLabel})`
                : line.name,
              quantity: line.quantity,
              amount: roundMoney(line.unitPrice * line.quantity),
            })),
          },
        ],
        totals: [
          { label: "Subtotal", amount: subtotal },
          {
            label: `${result.tax.name ?? "Tax"} (${result.tax.rate}%)`,
            amount: tax,
          },
          ...(adjustment > 0
            ? [
                {
                  label: `${PAYMENT_METHOD_LABEL[method]} price`,
                  amount: adjustment,
                },
              ]
            : []),
        ],
        grandTotal,
        payment: {
          method: PAYMENT_METHOD_LABEL[method],
          ...(method === "cash" ? { tendered, change: result.changeDue } : {}),
        },
      };

      cart.clear();
      setReceipt({ orderNumber: result.order.orderNumber, rows, data });
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
      subtitle={
        receipt
          ? undefined
          : "Payment places the order and sends it to the kitchen"
      }
    >
      {receipt ? (
        <PaymentSuccess
          title={`Order #${receipt.orderNumber} paid`}
          subtitle="Sent to the kitchen. It shows under “Ready for pickup” when done."
          rows={receipt.rows}
          receipt={receipt.data}
          doneLabel="New order"
          onDone={onDismiss}
        />
      ) : (
        <>
          <KeyboardAwareScrollView
            style={{ flexShrink: 1 }}
            contentContainerClassName="gap-4 px-4 pb-4"
            keyboardShouldPersistTaps="handled"
          >
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
              <SummaryRow
                label="Total due"
                value={formatRs(totals.total)}
                tone="total"
              />
              {customer.customerName || customer.customerPhone ? (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
                >
                  Customer:{" "}
                  {[customer.customerName, customer.customerPhone]
                    .filter(Boolean)
                    .join(" · ")}
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

            {error ? (
              <HelperText type="error" padding="none">
                {error}
              </HelperText>
            ) : null}
          </KeyboardAwareScrollView>

          <View className="px-4">
            <Button
              mode="contained"
              icon="check"
              onPress={pay}
              loading={createOrder.isPending}
              disabled={
                createOrder.isPending ||
                taxLoading ||
                cart.lines.length === 0 ||
                tender.amount === null ||
                !!tender.error
              }
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
