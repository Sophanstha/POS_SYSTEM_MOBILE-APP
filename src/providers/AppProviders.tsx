import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { focusManager, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from "expo-router";
import { useEffect, useMemo, type ComponentProps, type ReactNode } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider, useThemeMode } from "../context/ThemeContext";
import { queryClient } from "../lib/queryClient";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/** Tell TanStack Query when the app is in the foreground, so polling
 *  (refetchInterval) pauses in the background and refetches on return. */
function useAppStateFocus() {
  useEffect(() => {
    const onChange = (status: AppStateStatus) => {
      if (Platform.OS !== "web") focusManager.setFocused(status === "active");
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, []);
}

export default function AppProviders({ children }: { children: ReactNode }) {
  useAppStateFocus();

  // Auth comes before the theme so each user's saved light/dark choice can be loaded.
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <ThemedProviders>{children}</ThemedProviders>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/** Paper and navigation both follow the one light/dark mode from ThemeContext. */
function ThemedProviders({ children }: { children: ReactNode }) {
  const { theme, isDark } = useThemeMode();

  // Screen / header colours expo-router uses (incl. during screen transitions).
  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.background,
        text: theme.colors.onBackground,
        border: theme.colors.outlineVariant,
        notification: theme.colors.error,
      },
    };
  }, [theme, isDark]);

  return (
    <PaperProvider
      theme={theme}
      settings={{
        // Paper's own icons (TextInput.Icon, List.Icon, Button icon=…) use @expo/vector-icons.
        icon: ({ name, size, color }) => (
          <MaterialCommunityIcons name={name as IconName} size={size} color={color} />
        ),
      }}
    >
      <NavigationThemeProvider value={navigationTheme}>{children}</NavigationThemeProvider>
    </PaperProvider>
  );
}
