import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { View } from "react-native";
import { Text } from "react-native-paper";

import { useAppTheme } from "../theme/paperTheme";

/** Temporary body for routes that are built in the next steps. */
export default function ComingSoonScreen({ title }: { title: string }) {
  const theme = useAppTheme();

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background px-6">
      <MaterialCommunityIcons name="hammer-wrench" size={40} color={theme.colors.onSurfaceVariant} />
      <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
        {title}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
        This screen is coming in the next step.
      </Text>
    </View>
  );
}