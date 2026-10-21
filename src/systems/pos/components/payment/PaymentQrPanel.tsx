import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Image, useWindowDimensions, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

import { useAppTheme } from "../../../../shared/theme/paperTheme";
import { usePaymentQr } from "../../hooks/usePaymentQr";
import { formatRs } from "../../lib/pos";


export default function PaymentQrPanel({ amount }: { amount: number }) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const qr = usePaymentQr();
  const size = Math.min(240, width - 96);

  if (qr.isLoading) return <ActivityIndicator style={{ alignSelf: "flex-start" }} />;

  if (!qr.data) {
    return (
      <View className="flex-row items-start gap-3 rounded-xl p-3" style={{ backgroundColor: theme.colors.surfaceVariant }}>
        <MaterialCommunityIcons name="qrcode-remove" size={22} color={theme.colors.onSurfaceVariant} />
        <Text variant="bodySmall" style={{ flex: 1, color: theme.colors.onSurfaceVariant }}>
          No payment QR on this phone yet. A manager or owner can add it in Settings → Payment QR. For now, show the
          shop's printed QR.
        </Text>
      </View>
    );
  }

  return (
    <View className="items-center gap-3 rounded-xl p-4" style={{ borderWidth: 1, borderColor: theme.colors.outlineVariant }}>
      <Text variant="titleMedium" style={{ fontWeight: "700" }}>
        Scan to pay {formatRs(amount)}
      </Text>
      <View className="rounded-xl bg-white p-2">
        <Image
          source={{ uri: qr.data }}
          accessibilityLabel="Shop payment QR code"
          resizeMode="contain"
          style={{ width: size, height: size }}
        />
      </View>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
        Ask the customer to scan, enter {formatRs(amount)} and pay. Tap Confirm payment only after the money shows on the
        shop's phone.
      </Text>
    </View>
  );
}