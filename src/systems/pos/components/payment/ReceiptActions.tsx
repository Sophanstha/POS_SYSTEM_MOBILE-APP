import { useState } from "react";
import { View } from "react-native";
import { Button, HelperText } from "react-native-paper";

import { printReceipt, shareReceipt, type ReceiptData } from "../../lib/receipt";

/** "Print" and "Share PDF" buttons for a receipt. */
export default function ReceiptActions({ receipt }: { receipt: ReceiptData }) {
  const [busy, setBusy] = useState<"print" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "print" | "share", action: (r: ReceiptData) => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await action(receipt);
    } catch (e) {
      // Closing the print / share screen is not an error.
      const message = e instanceof Error ? e.message : "";
      if (!/cancel/i.test(message)) setError(message || "Couldn't create the receipt. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="w-full gap-1">
      <View className="flex-row gap-2">
        <Button
          mode="outlined"
          icon="printer-outline"
          style={{ flex: 1 }}
          contentStyle={{ height: 46 }}
          loading={busy === "print"}
          disabled={!!busy}
          onPress={() => run("print", printReceipt)}
        >
          Print
        </Button>
        <Button
          mode="outlined"
          icon="share-variant-outline"
          style={{ flex: 1 }}
          contentStyle={{ height: 46 }}
          loading={busy === "share"}
          disabled={!!busy}
          onPress={() => run("share", shareReceipt)}
        >
          Share PDF
        </Button>
      </View>
      {error ? (
        <HelperText type="error" padding="none" style={{ textAlign: "center" }}>
          {error}
        </HelperText>
      ) : null}
    </View>
  );
}