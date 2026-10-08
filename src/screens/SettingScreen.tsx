import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Constants from "expo-constants";
import { useState, type ComponentProps, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Avatar, Button, Dialog, Portal, SegmentedButtons, Text } from "react-native-paper";

import { useAuth } from "../context/AuthContext";
import { useThemeMode, type ThemeMode } from "../context/ThemeContext";
import { useAppTheme } from "../theme/paperTheme";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

function initials(name: string | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

/** Profile, theme and logout — shared by waiter and cashier. */
export default function SettingsScreen() {
  const theme = useAppTheme();
  const { user, role, activeOutlet, logout } = useAuth();
  const { mode, setMode } = useThemeMode();

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const doLogout = async () => {
    setLoggingOut(true);
    await logout(); // the router leaves this screen once signed out
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 px-4 pb-10 pt-2">
        {/* Profile */}
        <View
          className="flex-row items-center gap-4 rounded-2xl p-4"
          style={{ borderWidth: 1, borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }}
        >
          <Avatar.Text
            size={56}
            label={initials(user?.name)}
            style={{ backgroundColor: theme.colors.primaryContainer }}
            color={theme.colors.primary}
          />
          <View className="flex-1 gap-0.5">
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: "700" }} numberOfLines={1}>
              {user?.name ?? ""}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
              {user?.email ?? ""}
            </Text>
            {role ? (
              <View
                className="mt-1 self-start rounded-full px-2.5 py-0.5"
                style={{ backgroundColor: theme.colors.primaryContainer }}
              >
                <Text style={{ color: theme.colors.primary, fontSize: 11, fontWeight: "700" }}>{role}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Section title="Outlet">
          <Row icon="storefront-outline" label="Working at" value={activeOutlet?.name ?? "No outlet"} />
        </Section>

        <Section title="Appearance">
          <View className="p-3">
            <SegmentedButtons
              value={mode}
              onValueChange={(value) => setMode(value as ThemeMode)}
              buttons={[
                { value: "dark", label: "Dark", icon: "moon-waning-crescent" },
                { value: "light", label: "Light", icon: "white-balance-sunny" },
              ]}
            />
          </View>
        </Section>

        <Section title="About">
          <Row icon="cellphone" label="App" value={Constants.expoConfig?.name ?? "POS"} />
          <Divider />
          <Row icon="information-outline" label="Version" value={Constants.expoConfig?.version ?? "—"} />
        </Section>

        <Button
          mode="outlined"
          icon="logout"
          onPress={() => setConfirmLogout(true)}
          textColor={theme.colors.error}
          style={{ borderColor: theme.colors.outlineVariant }}
          contentStyle={{ height: 48 }}
        >
          Logout
        </Button>
      </ScrollView>

      <Portal>
        <Dialog
          visible={confirmLogout}
          onDismiss={loggingOut ? undefined : () => setConfirmLogout(false)}
          style={{ backgroundColor: theme.colors.surface }}
        >
          <Dialog.Title>Log out?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Open orders stay on the server. You can log back in any time.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmLogout(false)} disabled={loggingOut}>
              Cancel
            </Button>
            <Button onPress={doLogout} loading={loggingOut} disabled={loggingOut} textColor={theme.colors.error}>
              Logout
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <View className="gap-2">
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, letterSpacing: 1, marginLeft: 4 }}>
        {title.toUpperCase()}
      </Text>
      <View
        className="overflow-hidden rounded-2xl"
        style={{ borderWidth: 1, borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }}
      >
        {children}
      </View>
    </View>
  );
}

function Row({ icon, label, value, right }: { icon: IconName; label: string; value: string; right?: ReactNode }) {
  const theme = useAppTheme();
  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <MaterialCommunityIcons name={icon} size={22} color={theme.colors.onSurfaceVariant} />
      <View className="flex-1">
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {label}
        </Text>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {right}
    </View>
  );
}

function Divider() {
  const theme = useAppTheme();
  return <View style={{ height: 1, marginLeft: 50, backgroundColor: theme.colors.outlineVariant }} />;
}