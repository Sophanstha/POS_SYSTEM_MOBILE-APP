import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { SYSTEM_LIST, type SystemId, type SystemInfo } from "../../systems";
import { useSystem } from "../context/SystemContext";
import { useAppTheme } from "../theme/paperTheme";

/**
 * First open: "What is your business?" with POS, IMS and DMS. The choice is saved on the
 * phone, so it's asked only once; the login page of that business opens by itself.
 */
export default function ChooseSystemScreen() {
  const theme = useAppTheme();
  const { chooseSystem } = useSystem();
  const [saving, setSaving] = useState<SystemId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (id: SystemId) => {
    if (saving) return;
    setError(null);
    setSaving(id);
    try {
      await chooseSystem(id);
    } catch {
      setError("Couldn't save your choice. Please try again.");
      setSaving(null);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom", "left", "right"]}>
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-10"
          // Tablet / landscape: centered cards, not stretched across the screen.
          contentContainerStyle={{ width: "100%", maxWidth: 520, alignSelf: "center" }}
        >
          <Text
            variant="headlineMedium"
            accessibilityRole="header"
            style={{ textAlign: "center", fontWeight: "300", letterSpacing: 1, color: theme.colors.onBackground }}
          >
            What is your business?
          </Text>
          <Text
            variant="bodyMedium"
            style={{ textAlign: "center", color: theme.colors.onSurfaceVariant, marginTop: 8, marginBottom: 32 }}
          >
            Choose once and the app remembers it on this phone. You can change it later from the login page.
          </Text>

          <View className="gap-3">
            {SYSTEM_LIST.map((system) => (
              <SystemCard
                key={system.id}
                system={system}
                saving={saving === system.id}
                disabled={!!saving}
                onPress={() => pick(system.id)}
              />
            ))}
          </View>

          {error ? (
            <View className="mt-6 flex-row items-center justify-center gap-2">
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.colors.error} />
              <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
                {error}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** One business: its colour and icon, name, one line about it; "Coming soon" when not ready. */
function SystemCard({
  system,
  saving,
  disabled,
  onPress,
}: {
  system: SystemInfo;
  saving: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const soon = !system.ready;

  return (
    <Pressable
      onPress={onPress}
      disabled={soon || disabled}
      accessibilityRole="button"
      accessibilityLabel={`${system.name}: ${system.description}${soon ? ". Coming soon" : ""}`}
      accessibilityState={{ disabled: soon || disabled, busy: saving }}
      className="flex-row items-center gap-4 rounded-2xl p-4"
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.colors.surfaceVariant : theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
        opacity: soon ? 0.55 : 1,
      })}
    >
      {/* Grey until the business has its own colour. */}
      <View
        className="h-14 w-14 items-center justify-center rounded-xl"
        style={{ backgroundColor: system.brand ?? theme.colors.surfaceVariant }}
      >
        <MaterialCommunityIcons
          name={system.icon}
          size={28}
          color={system.brand ? "#ffffff" : theme.colors.onSurfaceVariant}
        />
      </View>

      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text variant="titleMedium" style={{ fontWeight: "700", color: theme.colors.onSurface }}>
            {system.name}
          </Text>
          {soon ? (
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: theme.colors.surfaceVariant }}>
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Coming soon
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {system.description}
        </Text>
      </View>

      {saving ? (
        <ActivityIndicator color={theme.colors.onSurface} />
      ) : soon ? null : (
        <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
      )}
    </Pressable>
  );
}
