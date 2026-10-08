import * as SecureStore from "expo-secure-store";
import * as SystemUI from "expo-system-ui";
import { colorScheme as nativewindScheme } from "nativewind";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { darkTheme, lightTheme, type AppTheme } from "../theme/paperTheme";
import { useAuth } from "./AuthContext";

export type ThemeMode = "dark" | "light";

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  theme: AppTheme;
  /** False until the saved theme has been read (keeps the splash screen up). */
  ready: boolean;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const DEVICE_KEY = "pos.theme";
// SecureStore keys may only contain letters, numbers, ".", "-" and "_".
const userKey = (userId: string) => `${DEVICE_KEY}.${userId.replace(/[^\w.-]/g, "_")}`;

async function readMode(key: string): Promise<ThemeMode | null> {
  try {
    const saved = await SecureStore.getItemAsync(key);
    return saved === "dark" || saved === "light" ? saved : null;
  } catch {
    return null;
  }
}

// Match the POS: dark until a saved choice says otherwise.
nativewindScheme.set("dark");

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * One source of truth for light/dark, like the web's ThemeContext:
 * dark by default, toggle, remembered per user (and per device for the login screen).
 * Keeps NativeWind (className colours), Paper and the Android root view in sync.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [ready, setReady] = useState(false);

  // Last theme used on this device — shown on the login screen and at start-up.
  useEffect(() => {
    readMode(DEVICE_KEY).then((saved) => {
      if (saved) setModeState(saved);
      setReady(true);
    });
  }, []);

  // After login, switch to that user's own choice (if they made one).
  useEffect(() => {
    if (!user) return;
    readMode(userKey(user.id)).then((saved) => {
      if (saved) setModeState(saved);
    });
  }, [user?.id]);

  const theme = mode === "dark" ? darkTheme : lightTheme;

  useEffect(() => {
    nativewindScheme.set(mode);
    // Root view behind every screen (Android navigation/keyboard gaps, screen transitions).
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => {});
  }, [mode, theme]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      SecureStore.setItemAsync(DEVICE_KEY, next).catch(() => {});
      if (user) SecureStore.setItemAsync(userKey(user.id), next).catch(() => {});
    },
    [user],
  );

  const toggleTheme = useCallback(() => setMode(mode === "dark" ? "light" : "dark"), [mode, setMode]);

  const value = useMemo(
    () => ({ mode, isDark: mode === "dark", theme, ready, toggleTheme, setMode }),
    [mode, theme, ready, toggleTheme, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeMode must be used within ThemeProvider");
  return ctx;
}
