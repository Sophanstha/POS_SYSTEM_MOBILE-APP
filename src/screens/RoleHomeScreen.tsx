import { router, type Href } from "expo-router";
import { ScrollView, View } from "react-native";
import { Button, IconButton, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import ModuleCard, { type IconName } from "../components/ModuleCard";
import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";
import { useAppTheme } from "../theme/paperTheme";

export type HomeModule = {
  label: string;
  icon: IconName;
  href: Href;
};

/** Shared home screen for waiter and cashier: greeting, module cards, logout. */
export default function RoleHomeScreen({ modules }: { modules: HomeModule[] }) {
  const theme = useAppTheme();
  const { user, role, activeOutlet, logout } = useAuth();
  const { isDark, toggleTheme } = useThemeMode();

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View className="flex-row items-center justify-between px-5 pt-2">
          <View className="flex-1">
            <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
              {user?.name ?? ""}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {[role, activeOutlet?.name].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <IconButton
            icon={isDark ? "white-balance-sunny" : "moon-waning-crescent"}
            iconColor={isDark ? theme.colors.gold : theme.colors.onSurfaceVariant}
            mode="outlined"
            onPress={toggleTheme}
            accessibilityLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
          />
        </View>

        <ScrollView contentContainerClassName="flex-grow justify-center gap-8 px-5 py-8">
          <View className="gap-2">
            <Text
              variant="headlineLarge"
              style={{ textAlign: "center", fontWeight: "700", color: theme.colors.onBackground }}
            >
              WELCOME BACK
            </Text>
            <Text
              variant="bodyLarge"
              style={{ textAlign: "center", color: theme.colors.onSurfaceVariant }}
            >
              Select a service module to begin.
            </Text>
          </View>

          <View className="gap-4">
            {modules.map((m) => (
              <ModuleCard
                key={m.label}
                label={m.label}
                icon={m.icon}
                onPress={() => router.push(m.href)}
              />
            ))}
          </View>
        </ScrollView>

        <View className="px-5 pb-4">
          <Button
            mode="outlined"
            icon="logout"
            onPress={logout}
            textColor={theme.colors.error}
            style={{ borderColor: theme.colors.outlineVariant }}
            contentStyle={{ height: 48 }}
          >
            Logout
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}