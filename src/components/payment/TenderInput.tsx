import { View } from "react-native";
import { Button, Chip, HelperText, TextInput } from "react-native-paper";

import { formatRs, isPlatformMethod, PAYMENT_METHOD_LABEL, quickCashAmounts, type Tender } from "../../lib/pos";
import { useAppTheme } from "../../theme/paperTheme";
import type { PaymentMethod } from "../../types/pos";

type TenderInputProps = {
  method: PaymentMethod;
  due: number;
  value: string;
  onChange: (text: string) => void;
  tender: Tender;
  disabled?: boolean;
};

/**
 * Cash: "Amount received" with quick amounts and the change to give back.
 * Delivery platform: the platform's price. Card / QR need nothing.
 */
export default function TenderInput({ method, due, value, onChange, tender, disabled }: TenderInputProps) {
  const theme = useAppTheme();
  const isCash = method === "cash";
  if (!isCash && !isPlatformMethod(method)) return null;

  const showError = !!tender.error && value.trim() !== "";

  return (
    <View className="gap-2">
      <TextInput
        mode="outlined"
        label={isCash ? "Amount received" : `${PAYMENT_METHOD_LABEL[method]} price`}
        placeholder={due.toFixed(2)}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChange}
        disabled={disabled}
        error={showError}
        left={<TextInput.Affix text="Rs." />}
      />

      {isCash ? (
        <View className="flex-row flex-wrap gap-2">
          {quickCashAmounts(due).map((amount) => (
            <Chip key={amount} compact disabled={disabled} onPress={() => onChange(amount.toFixed(2))}>
              {amount === due ? "Exact" : formatRs(amount)}
            </Chip>
          ))}
        </View>
      ) : (
        <Button compact mode="text" style={{ alignSelf: "flex-start" }} disabled={disabled} onPress={() => onChange(due.toFixed(2))}>
          Use bill total ({formatRs(due)})
        </Button>
      )}

      {showError ? (
        <HelperText type="error" padding="none">
          {tender.error}
        </HelperText>
      ) : isCash && tender.amount !== null ? (
        <HelperText type="info" padding="none" style={{ color: theme.colors.success, fontWeight: "700", fontSize: 15 }}>
          Change to return: {formatRs(tender.change)}
        </HelperText>
      ) : !isCash && tender.amount !== null && tender.amount > due ? (
        <HelperText type="info" padding="none" style={{ color: theme.colors.warning }}>
          The platform price ({formatRs(tender.amount)}) is recorded as the amount paid.
        </HelperText>
      ) : null}
    </View>
  );
}