import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { View } from "react-native";
import { Button, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../theme/paperTheme";

/** Shown to roles the mobile app doesn't support (Owner, Manager, Kitchen Crew, no role). */
export default function UnsupportedRoleScreen() {
  const theme = useAppTheme();
  const { role, activeOutletId, logout } = useAuth();

  const message = !activeOutletId
    ? "Your account has no active outlet. Please use the web app or contact your manager."
    : `The mobile app is for waiters and cashiers. Please use the web app${role ? ` for the ${role} role` : ""}.`;

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <MaterialCommunityIcons name="cellphone-off" size={48} color={theme.colors.onSurfaceVariant} />
          <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
            Not available
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}
          >
            {message}
          </Text>
          <Button
            mode="outlined"
            icon="logout"
            onPress={logout}
            textColor={theme.colors.onBackground}
            style={{ marginTop: 16, borderColor: theme.colors.outline }}
          >
            Log out
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}