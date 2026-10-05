import "../global.css";

import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colorScheme } from "nativewind";

import { useAuth } from "../src/context/AuthContext";
import { useStackScreenOptions } from "../src/navigation/useStackScreenOptions";
import AppProviders from "../src/providers/AppProviders";

// Match the POS: dark theme by default.
colorScheme.set("dark");

// Keep the splash screen up until the saved session has been checked.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppProviders>
      <SplashScreenController />
      <RootNavigator />
      <StatusBar style="auto" />
    </AppProviders>
  );
}

function SplashScreenController() {
  const { status } = useAuth();
  if (status !== "loading") SplashScreen.hide();
  return null;
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