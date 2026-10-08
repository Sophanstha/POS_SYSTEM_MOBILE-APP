import { View } from "react-native";
import { Text } from "react-native-paper";

import { useAppTheme } from "../../theme/paperTheme";

type SummaryRowProps = {
  label: string;
  value: string;
  /** "total" = big and bold, "muted" = small grey line. */
  tone?: "default" | "total" | "muted" | "success";
};

/** One "label …… Rs.0.00" line of a bill. */
export default function SummaryRow({ label, value, tone = "default" }: SummaryRowProps) {
  const theme = useAppTheme();
  const isTotal = tone === "total";
  const color =
    tone === "total"
      ? theme.colors.onSurface
      : tone === "success"
        ? theme.colors.success
        : theme.colors.onSurfaceVariant;
  const variant = isTotal ? "titleMedium" : tone === "muted" ? "bodySmall" : "bodyMedium";
  const style = { color, fontWeight: isTotal || tone === "success" ? ("700" as const) : undefined };

  return (
    <View className="flex-row justify-between gap-3">
      <Text variant={variant} style={[style, { flex: 1 }]}>
        {label}
      </Text>
      <Text variant={variant} style={isTotal ? [style, { color: theme.colors.primary }] : style}>
        {value}
      </Text>
    </View>
  );
}