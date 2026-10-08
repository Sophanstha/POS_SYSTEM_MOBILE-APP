import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { View } from "react-native";
import { Card, Text } from "react-native-paper";

import { TABLE_STATUS_LABEL } from "../lib/pos";
import { useAppTheme } from "../theme/paperTheme";
import { tableStatusColor } from "../theme/statusColors";
import type { DiningTable } from "../types/pos";
import StatusPill from "./StatusPill";

type TableCardProps = {
  table: DiningTable;
  foodReady: boolean;
  onPress: () => void;
};

export default function TableCard({ table, foodReady, onPress }: TableCardProps) {
  const theme = useAppTheme();
  const color = tableStatusColor(theme, table.status);

  return (
    <Card
      mode="outlined"
      onPress={onPress}
      accessibilityLabel={`Table ${table.tableNumber}, ${TABLE_STATUS_LABEL[table.status]}`}
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: foodReady ? theme.colors.success : theme.colors.outlineVariant,
        borderWidth: foodReady ? 2 : 1,
      }}
    >
      <View className="gap-3 p-4">
        <View className="flex-row items-start justify-between">
          <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, fontWeight: "700" }}>
            {table.tableNumber}
          </Text>
          <View className="flex-row items-center gap-1">
            <MaterialCommunityIcons name="account-group-outline" size={16} color={theme.colors.onSurfaceVariant} />
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {table.capacity}
            </Text>
          </View>
        </View>

        <StatusPill label={TABLE_STATUS_LABEL[table.status]} color={color} />

        {foodReady ? (
          <View className="flex-row items-center gap-1">
            <MaterialCommunityIcons name="bell-ring-outline" size={14} color={theme.colors.success} />
            <Text variant="labelSmall" style={{ color: theme.colors.success, fontWeight: "700" }}>
              FOOD READY
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}