import "../global.css";

import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { useAuth } from "../src/shared/context/AuthContext";
import { useSystem } from "../src/shared/context/SystemContext";
import { useThemeMode } from "../src/shared/context/ThemeContext";
import { useStackScreenOptions } from "../src/shared/navigation/useStackScreenOptions";
import AppProviders from "../src/shared/providers/AppProviders";
import AppErrorBoundary from "../src/shared/components/AppErrorBoundary";
import ConnectionBanner from "../src/shared/components/ConnectionBanner";
import BusinessAuthProvider from "../src/systems/BusinessAuthProvider";

// Keep the splash screen up until the saved session has been checked.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppProviders AuthProvider={BusinessAuthProvider}>
      <AppErrorBoundary>
        <SplashScreenController />
        <RootNavigator />
      </AppErrorBoundary>
      <ConnectionBanner />
      <ThemedStatusBar />
    </AppProviders>
  );
}

function SplashScreenController() {
  const { status } = useAuth();
  const { ready } = useThemeMode();
  const system = useSystem();
  // Also wait for the saved theme and business, so the app never flashes the wrong screen or colours.
  if (status !== "loading" && ready && system.status === "ready") SplashScreen.hide();
  return null;
}

/** Light status-bar icons on the dark theme, dark icons on the light theme. */
function ThemedStatusBar() {
  const { isDark } = useThemeMode();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

/**
 * Only the screens the current user may see are available. When a guard turns
 * false (business picked or changed, login, logout, session expired) the router
 * falls back to `index`, which redirects to the right place.
 */
function RootNavigator() {
  const screenOptions = useStackScreenOptions();
  const { status, appRole } = useAuth();
  const system = useSystem();
  const signedIn = status === "signedIn";
  const picked = system.system;
  const pos = signedIn && picked === "pos";

  return (
    <Stack screenOptions={{ ...screenOptions, headerShown: false }}>
      <Stack.Screen name="index" />

      {/* First open: pick the business (POS / IMS / DMS). */}
      <Stack.Protected guard={system.status === "ready" && !picked}>
        <Stack.Screen name="choose" />
      </Stack.Protected>

      <Stack.Protected guard={status === "signedOut" && !!picked}>
        <Stack.Screen name="login" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>

      <Stack.Protected guard={pos && appRole === "waiter"}>
        <Stack.Screen name="pos/waiter" />
      </Stack.Protected>

      <Stack.Protected guard={pos && appRole === "cashier"}>
        <Stack.Screen name="pos/cashier" />
      </Stack.Protected>

      <Stack.Protected guard={pos && appRole === "kitchen"}>
        <Stack.Screen name="pos/kitchen" />
      </Stack.Protected>
      <Stack.Protected guard={pos && appRole === "manager"}>
        <Stack.Screen name="pos/manager" />
      </Stack.Protected>

      <Stack.Protected guard={pos && appRole === "owner"}>
        <Stack.Screen name="pos/owner" />
      </Stack.Protected>

      <Stack.Protected guard={pos && appRole === "unsupported"}>
        <Stack.Screen name="pos/unsupported" />
      </Stack.Protected>
    </Stack>
  );
}
