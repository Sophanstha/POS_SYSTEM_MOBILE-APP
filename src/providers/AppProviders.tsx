import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { focusManager, QueryClientProvider } from "@tanstack/react-query";
import { useColorScheme } from "nativewind";
import { useEffect, type ComponentProps, type ReactNode } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../context/AuthContext";
import { queryClient } from "../lib/queryClient";
import { darkTheme, lightTheme } from "../theme/paperTheme";

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

  // Paper follows the same light/dark mode as NativeWind (colorScheme.set / toggle).
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === "light" ? lightTheme : darkTheme;

  return (
    <SafeAreaProvider>
      <PaperProvider
        theme={theme}
        settings={{
          // Paper's own icons (TextInput.Icon, List.Icon, Button icon=…) use @expo/vector-icons.
          icon: ({ name, size, color }) => (
            <MaterialCommunityIcons name={name as IconName} size={size} color={color} />
          ),
        }}
      >
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
