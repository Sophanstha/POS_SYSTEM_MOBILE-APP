import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { View } from "react-native";
import { Card, Text } from "react-native-paper";

import { useAppTheme } from "../theme/paperTheme";

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type ModuleCardProps = {
  label: string;
  icon: IconName;
  onPress: () => void;
};

export default function ModuleCard({ label, icon, onPress }: ModuleCardProps) {
  const theme = useAppTheme();

  return (
    <Card
      mode="outlined"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }}
    >
      <View className="items-center justify-center gap-4 py-10">
        <View
          className="h-16 w-16 items-center justify-center rounded-full border-2"
          style={{
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.primaryContainer,
          }}
        >
          <MaterialCommunityIcons name={icon} size={28} color={theme.colors.primary} />
        </View>
        <Text variant="titleLarge" style={{ color: theme.colors.primary, letterSpacing: 0.5 }}>
          {label}
        </Text>
      </View>
    </Card>
  );
}