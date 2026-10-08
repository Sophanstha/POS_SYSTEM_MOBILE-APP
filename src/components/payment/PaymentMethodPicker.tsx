import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import { Text } from "react-native-paper";

import { PAYMENT_METHOD_LABEL, PAYMENT_METHODS } from "../../lib/pos";
import { useAppTheme } from "../../theme/paperTheme";
import type { PaymentMethod } from "../../types/pos";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const ICON: Record<PaymentMethod, IconName> = {
  cash: "cash",
  card: "credit-card-outline",
  qr: "qrcode-scan",
  yango: "moped",
  foodmandu: "moped",
  pathao: "moped",
};

type PaymentMethodPickerProps = {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  methods?: PaymentMethod[];
  disabled?: boolean;
};

/** Grid of payment methods (3 per row), like the web payment modal. */
export default function PaymentMethodPicker({ value, onChange, methods = PAYMENT_METHODS, disabled }: PaymentMethodPickerProps) {
  const theme = useAppTheme();

  return (
    <View className="gap-2">
      <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
        Payment method
      </Text>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {methods.map((m) => {
          const selected = m === value;
          return (
            <Pressable
              key={m}
              onPress={() => onChange(m)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              accessibilityLabel={PAYMENT_METHOD_LABEL[m]}
              className="items-center justify-center gap-1 rounded-xl py-2.5 active:opacity-70"
              style={{
                flexBasis: "30%",
                flexGrow: 1,
                borderWidth: 1,
                borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceVariant,
                opacity: disabled ? 0.5 : 1,
              }}
            >
              <MaterialCommunityIcons
                name={ICON[m]}
                size={20}
                color={selected ? theme.colors.onPrimary : theme.colors.primary}
              />
              <Text
                variant="labelMedium"
                style={{ color: selected ? theme.colors.onPrimary : theme.colors.onSurface, fontWeight: "600" }}
              >
                {PAYMENT_METHOD_LABEL[m]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}