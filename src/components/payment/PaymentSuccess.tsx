import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { View } from "react-native";
import { Button, Text } from "react-native-paper";

import { useAppTheme } from "../../theme/paperTheme";
import SummaryRow from "./SummaryRow";

export type SuccessRow = { label: string; value: string; tone?: "default" | "total" | "muted" | "success" };

type PaymentSuccessProps = {
  title: string;
  subtitle?: string;
  rows: SuccessRow[];
  doneLabel?: string;
  loading?: boolean;
  onDone: () => void;
};

/** "Payment completed" screen shown inside a payment sheet. */
export default function PaymentSuccess({ title, subtitle, rows, doneLabel = "Done", loading, onDone }: PaymentSuccessProps) {
  const theme = useAppTheme();

  return (
    <View className="items-center gap-5 px-4 pb-2 pt-2">
      <View
        className="h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: `${theme.colors.success}1f`, borderWidth: 1, borderColor: `${theme.colors.success}4d` }}
      >
        <MaterialCommunityIcons name="check" size={34} color={theme.colors.success} />
      </View>

      <View className="items-center gap-1">
        <Text variant="titleLarge" style={{ color: theme.colors.onSurface, fontWeight: "700", textAlign: "center" }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View className="w-full gap-2 rounded-xl p-4" style={{ backgroundColor: theme.colors.surfaceVariant }}>
        {rows.map((row) => (
          <SummaryRow key={row.label} label={row.label} value={row.value} tone={row.tone} />
        ))}
      </View>

      <Button mode="contained" onPress={onDone} loading={loading} disabled={loading} style={{ alignSelf: "stretch" }} contentStyle={{ height: 52 }}>
        {doneLabel}
      </Button>
    </View>
  );
}