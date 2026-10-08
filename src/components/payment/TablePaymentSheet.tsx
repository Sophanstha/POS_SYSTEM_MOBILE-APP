import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { ActivityIndicator, Button, Divider, HelperText, Text } from "react-native-paper";

import { getErrorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useSettleTable, type TableBill } from "../../hooks/usePayment";
import { useSetTableStatus } from "../../hooks/useTables";
import { formatRs, PAYMENT_METHOD_LABEL, resolveTender, roundMoney, splitBill } from "../../lib/pos";
import { useAppTheme } from "../../theme/paperTheme";
import type { DiningTable, PaymentMethod } from "../../types/pos";
import BottomSheet from "./BottomSheet";
import PaymentMethodPicker from "./PaymentMethodPicker";
import PaymentSuccess, { type SuccessRow } from "./PaymentSuccess";
import SummaryRow from "./SummaryRow";
import TenderInput from "./TenderInput";

type TablePaymentSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  table: DiningTable;
  bill: TableBill;
  /** Called once the table is paid and set to "Cleaning". */
  onTableClosed: () => void;
};

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * Pay everything still owed on a table (web: "Process Table Payment").
 * Pays each open order its exact balance, then sets the table to Cleaning.
 */
export default function TablePaymentSheet({ visible, onDismiss, table, bill, onTableClosed }: TablePaymentSheetProps) {
  const theme = useAppTheme();
  const { hasPermission } = useAuth();
  const settle = useSettleTable();
  const setStatus = useSetTableStatus();

  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amountText, setAmountText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SuccessRow[] | null>(null);

  // Fresh form every time the sheet opens.
  useEffect(() => {
    if (visible) {
      setMethod("cash");
      setAmountText("");
      setError(null);
      setReceipt(null);
    }
  }, [visible]);

  const due = bill.totalDue;
  const tender = resolveTender(method, due, amountText);
  const nothingDue = !bill.loading && due <= 0;
  const busy = settle.isPending || setStatus.isPending;

  /** Paid → table needs cleaning (same as the web after a table payment). */
  const closeTable = () => {
    if (!hasPermission("restaurant.tables.update")) {
      onTableClosed();
      return;
    }
    setStatus.mutate(
      { tableId: table.id, status: "dirty" },
      {
        onSuccess: onTableClosed,
        onError: (e) => setError(getErrorMessage(e)),
      },
    );
  };

  const pay = async () => {
    if (tender.amount === null || tender.error) return;
    setError(null);
    const paidAmount = tender.amount;
    try {
      await settle.mutateAsync({ method, payments: splitBill(bill.dues, method, paidAmount) });

      const rows: SuccessRow[] = [{ label: "Amount paid", value: formatRs(method === "cash" ? due : paidAmount), tone: "total" }];
      if (bill.paidSoFar > 0) rows.push({ label: "Paid earlier (by item)", value: formatRs(bill.paidSoFar), tone: "muted" });
      rows.push({ label: "Method", value: PAYMENT_METHOD_LABEL[method] });
      if (method === "cash") {
        rows.push({ label: "Cash received", value: formatRs(paidAmount) });
        rows.push({ label: "Change to return", value: formatRs(tender.change), tone: "success" });
      }
      setReceipt(rows);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onDismiss={receipt ? closeTable : onDismiss}
      dismissable={!busy}
      title={receipt ? `Table ${table.tableNumber}` : `Pay bill · Table ${table.tableNumber}`}
      subtitle={receipt ? undefined : "Settle everything still owed on this table"}
    >
      {receipt ? (
        <>
          <PaymentSuccess
            title="Payment completed"
            subtitle="The table will be set to Cleaning."
            rows={receipt}
            doneLabel="Done"
            loading={setStatus.isPending}
            onDone={closeTable}
          />
          {error ? (
            <HelperText type="error" style={{ textAlign: "center" }}>
              {error}
            </HelperText>
          ) : null}
        </>
      ) : bill.loading ? (
        <View className="items-center py-10">
          <ActivityIndicator />
        </View>
      ) : nothingDue ? (
        <View className="gap-4 px-4 pb-2">
          <View className="items-center gap-1 rounded-xl p-5" style={{ backgroundColor: `${theme.colors.success}1f` }}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: "700" }}>
              Already fully paid
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
              Every item was paid individually{bill.paidSoFar > 0 ? ` (${formatRs(bill.paidSoFar)})` : ""}. Nothing left
              to collect — close the table so it can be cleaned.
            </Text>
          </View>
          {error ? <HelperText type="error">{error}</HelperText> : null}
          <Button mode="contained" icon="broom" onPress={closeTable} loading={setStatus.isPending} disabled={busy} contentStyle={{ height: 52 }}>
            Close table
          </Button>
        </View>
      ) : (
        <>
          <ScrollView style={{ flexShrink: 1 }} contentContainerClassName="gap-4 px-4 pb-4" keyboardShouldPersistTaps="handled">
            {bill.previousPayments.length > 0 ? (
              <View className="gap-1 rounded-xl p-3" style={{ backgroundColor: theme.colors.surfaceVariant }}>
                <SummaryRow label="Paid earlier (by item)" value={formatRs(bill.paidSoFar)} tone="success" />
                {bill.previousPayments.map((p) => (
                  <SummaryRow
                    key={p.id}
                    label={`${PAYMENT_METHOD_LABEL[p.method]} · ${time(p.createdAt)}`}
                    value={formatRs(p.amount)}
                    tone="muted"
                  />
                ))}
              </View>
            ) : null}

            <View className="gap-1">
              {bill.unpaidItems.map((item) => (
                <SummaryRow
                  key={item.orderItemId}
                  label={`${item.unpaidQty} × ${item.name}`}
                  value={formatRs(item.unitPrice * item.unpaidQty)}
                />
              ))}
              <Divider style={{ marginVertical: 6 }} />
              <SummaryRow label="Subtotal" value={formatRs(bill.unpaidSubtotal)} />
              <SummaryRow
                label={`Tax (${bill.taxRate}%)`}
                value={formatRs(Math.max(0, roundMoney(due - bill.unpaidSubtotal)))}
              />
              <SummaryRow label="Total due" value={formatRs(due)} tone="total" />
            </View>

            <PaymentMethodPicker
              value={method}
              onChange={(m) => {
                setMethod(m);
                setAmountText("");
              }}
              disabled={busy}
            />

            <TenderInput method={method} due={due} value={amountText} onChange={setAmountText} tender={tender} disabled={busy} />

            {error ? <HelperText type="error" padding="none">{error}</HelperText> : null}
          </ScrollView>

          <View className="px-4">
            <Button
              mode="contained"
              icon="check"
              onPress={pay}
              loading={settle.isPending}
              disabled={busy || tender.amount === null || !!tender.error}
              contentStyle={{ height: 52 }}
            >
              {`Confirm payment · ${formatRs(method === "cash" || tender.amount === null ? due : tender.amount)}`}
            </Button>
          </View>
        </>
      )}
    </BottomSheet>
  );
}