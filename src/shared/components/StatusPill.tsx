import { View } from "react-native";
import { Text } from "react-native-paper";

/** Small coloured label: dot + text on a tinted background. */
export default function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <View
      className="flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: `${color}1f` }}
    >
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <Text variant="labelSmall" style={{ color, fontWeight: "700" }}>
        {label}
      </Text>
    </View>
  );
}