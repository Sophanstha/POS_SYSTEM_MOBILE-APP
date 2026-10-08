import "../global.css";

import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { useAuth } from "../src/context/AuthContext";
import { useThemeMode } from "../src/context/ThemeContext";
import { useStackScreenOptions } from "../src/navigation/useStackScreenOptions";
import AppProviders from "../src/providers/AppProviders";

// Keep the splash screen up until the saved session has been checked.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppProviders>
      <SplashScreenController />
      <RootNavigator />
      <ThemedStatusBar />
    </AppProviders>
  );
}

function SplashScreenController() {
  const { status } = useAuth();
  const { ready } = useThemeMode();
  // Also wait for the saved theme, so the app never flashes the wrong colours.
  if (status !== "loading" && ready) SplashScreen.hide();
  return null;
}

/** Light status-bar icons on the dark theme, dark icons on the light theme. */
function ThemedStatusBar() {
  const { isDark } = useThemeMode();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

/**
 * Only the screens the current user may see are available. When a guard turns
 * false (login, logout, session expired) the router falls back to `index`,
 * which redirects to the right place.
 */
function RootNavigator() {
  const screenOptions = useStackScreenOptions();
  const { status, appRole } = useAuth();
  const signedIn = status === "signedIn";

  return (
    <Stack screenOptions={{ ...screenOptions, headerShown: false }}>
      <Stack.Screen name="index" />

      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="login" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && appRole === "waiter"}>
        <Stack.Screen name="waiter" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && appRole === "cashier"}>
        <Stack.Screen name="cashier" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && appRole === "unsupported"}>
        <Stack.Screen name="unsupported" />
      </Stack.Protected>
    </Stack>
  );
}