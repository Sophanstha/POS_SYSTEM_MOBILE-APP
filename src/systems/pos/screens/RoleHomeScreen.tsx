import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, type Href } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { Button, IconButton, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import ModuleCard, { type IconName } from "../../../shared/components/ModuleCard";
import { usePosAuth } from "../auth/PosAuthProvider";
import { useThemeMode } from "../../../shared/context/ThemeContext";
import { useLayout } from "../../../shared/hooks/useLayout";
import { useAppTheme } from "../../../shared/theme/paperTheme";
import { useWebPalette } from "../theme/webPalette";

export type HomeModule = {
  label: string;
  icon: IconName;
  href: Href;
};

/**
 * Shared home screen for waiter and cashier: greeting, module cards, logout.
 * Landscape / tablet: the web home (green gradient or black, big cards in a row).
 */
export default function RoleHomeScreen({ modules }: { modules: HomeModule[] }) {
  const { isWide } = useLayout();
  return isWide ? <WebHome modules={modules} /> : <PhoneHome modules={modules} />;
}

function PhoneHome({ modules }: { modules: HomeModule[] }) {
  const theme = useAppTheme();
  const { user, role, activeOutlet, appRole, logout } = usePosAuth();
  const { isDark, toggleTheme } = useThemeMode();

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View className="flex-row items-center justify-between px-5 pt-2">
          <View className="flex-1">
            <Text
              variant="titleMedium"
              style={{ color: theme.colors.onBackground }}
            >
              {user?.name ?? ""}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {[role, activeOutlet?.name].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <IconButton
            icon={isDark ? "white-balance-sunny" : "moon-waning-crescent"}
            iconColor={
              isDark ? theme.colors.gold : theme.colors.onSurfaceVariant
            }
            mode="outlined"
            onPress={toggleTheme}
            accessibilityLabel={
              isDark ? "Switch to light theme" : "Switch to dark theme"
            }
          />
          <IconButton
            icon="cog-outline"
            iconColor={theme.colors.onSurfaceVariant}
            mode="outlined"
            onPress={() => router.push(`/${appRole}/settings`)}
            accessibilityLabel="Settings"
          />
        </View>

        <ScrollView contentContainerClassName="flex-grow justify-center gap-8 px-5 py-8">
          <View className="gap-2">
            <Text
              variant="headlineLarge"
              style={{
                textAlign: "center",
                fontWeight: "700",
                color: theme.colors.onBackground,
              }}
            >
              WELCOME BACK
            </Text>
            <Text
              variant="bodyLarge"
              style={{
                textAlign: "center",
                color: theme.colors.onSurfaceVariant,
              }}
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

/** The web POS home: "WELCOME BACK", module cards side by side, settings top right, logout bottom right. */
function WebHome({ modules }: { modules: HomeModule[] }) {
  const { user, role, activeOutlet, appRole, logout } = usePosAuth();
  const { isDark, toggleTheme } = useThemeMode();
  const { height } = useLayout();
  const web = useWebPalette();
  const home = web.home;
  const cardHeight = Math.max(150, Math.min(340, height * 0.42));

  return (
    <View style={{ flex: 1, backgroundColor: home.bg, experimental_backgroundImage: home.gradient }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom", "left", "right"]}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, gap: 20, paddingHorizontal: 32, paddingVertical: 16 }}>
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text style={{ color: home.title, fontSize: 16, fontWeight: "600" }}>{user?.name ?? ""}</Text>
              <Text style={{ color: home.subtitle, fontSize: 12 }}>{[role, activeOutlet?.name].filter(Boolean).join(" · ")}</Text>
            </View>
            <HomeButton
              icon={isDark ? "white-balance-sunny" : "moon-waning-crescent"}
              accessibilityLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
              onPress={toggleTheme}
            />
            <HomeButton icon="cog-outline" accessibilityLabel="Settings" onPress={() => router.push(`/${appRole}/settings`)} />
          </View>

          <View className="items-center gap-2">
            <Text style={{ color: home.title, fontSize: 40, fontWeight: "700", letterSpacing: -0.5, textAlign: "center" }}>
              WELCOME BACK
            </Text>
            <Text style={{ color: home.subtitle, fontSize: 16, textAlign: "center" }}>Select a service module to begin.</Text>
          </View>

          <View className="flex-1 flex-row items-center gap-5" style={{ width: "100%", maxWidth: 1024, alignSelf: "center" }}>
            {modules.map((m) => (
              <Pressable
                key={m.label}
                onPress={() => router.push(m.href)}
                accessibilityRole="button"
                accessibilityLabel={m.label}
                className="flex-1 items-center justify-center rounded-2xl active:opacity-80"
                style={{
                  height: cardHeight,
                  backgroundColor: home.card,
                  borderWidth: 1,
                  borderColor: home.cardBorder,
                  elevation: isDark ? 0 : 6,
                  shadowColor: "#000",
                  shadowOpacity: isDark ? 0 : 0.15,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 8 },
                }}
              >
                <View
                  className="mb-5 h-20 w-20 items-center justify-center rounded-full"
                  style={{ borderWidth: 2, borderColor: home.iconCircleBorder, backgroundColor: home.iconCircle }}
                >
                  <MaterialCommunityIcons name={m.icon} size={32} color={web.accent} />
                </View>
                <Text style={{ color: web.accent, fontSize: 22, fontWeight: "600", letterSpacing: 0.5 }}>{m.label}</Text>
              </Pressable>
            ))}
          </View>

          <View className="flex-row justify-end">
            <Pressable
              onPress={logout}
              accessibilityRole="button"
              className="flex-row items-center gap-2 rounded-xl px-4 py-2.5 active:opacity-70"
              style={{ backgroundColor: home.buttonBg, borderWidth: 1, borderColor: home.buttonBorder }}
            >
              <MaterialCommunityIcons name="logout" size={16} color={home.buttonText} />
              <Text style={{ color: home.buttonText, fontSize: 14, fontWeight: "500" }}>Logout</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function HomeButton({ icon, accessibilityLabel, onPress }: { icon: IconName; accessibilityLabel: string; onPress: () => void }) {
  const home = useWebPalette().home;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="rounded-xl p-2.5 active:opacity-70"
      style={{ backgroundColor: home.buttonBg, borderWidth: 1, borderColor: home.buttonBorder }}
    >
      <MaterialCommunityIcons name={icon} size={20} color={home.buttonText} />
    </Pressable>
  );
}
