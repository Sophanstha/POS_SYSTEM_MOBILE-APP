import { MD3DarkTheme, MD3LightTheme, useTheme } from "react-native-paper";

/**
 * React Native Paper themes built from the POS colours (same values as global.css).
 * Dark: near-black + gold accent. Light: slate + emerald accent.
 */

// Extra POS colours that Paper doesn't have. Same in both modes.
const posColors = {
  success: "#22c55e",
  warning: "#f59e0b",
  info: "#3b82f6",
  brand: "#0f6b4a",
  brandAccent: "#18a172",
  gold: "#e5b83b",
};

export const darkTheme = {
  ...MD3DarkTheme,
  roundness: 3,
  colors: {
    ...MD3DarkTheme.colors,
    ...posColors,
    primary: "#e5b83b",
    onPrimary: "#0c0c0d",
    primaryContainer: "#3a2f12",
    onPrimaryContainer: "#f5c847",
    secondary: "#18a172",
    onSecondary: "#ffffff",
    background: "#09090b",
    onBackground: "#ffffff",
    surface: "#141416",
    onSurface: "#ffffff",
    surfaceVariant: "#18181b",
    onSurfaceVariant: "#a1a1aa",
    outline: "#3f3f46",
    outlineVariant: "#27272a",
    error: "#ef4444",
    onError: "#ffffff",
    elevation: {
      level0: "transparent",
      level1: "#141416",
      level2: "#18181b",
      level3: "#1c1c1f",
      level4: "#1f1f23",
      level5: "#27272a",
    },
  },
};

export const lightTheme: AppTheme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    ...posColors,
    primary: "#059669",
    onPrimary: "#ffffff",
    primaryContainer: "#d1fae5",
    onPrimaryContainer: "#047857",
    secondary: "#0f6b4a",
    onSecondary: "#ffffff",
    background: "#f8fafc",
    onBackground: "#1e293b",
    surface: "#ffffff",
    onSurface: "#1e293b",
    surfaceVariant: "#f1f5f9",
    onSurfaceVariant: "#64748b",
    outline: "#cbd5e1",
    outlineVariant: "#e2e8f0",
    error: "#ef4444",
    onError: "#ffffff",
    elevation: {
      level0: "transparent",
      level1: "#ffffff",
      level2: "#f8fafc",
      level3: "#f1f5f9",
      level4: "#eef2f6",
      level5: "#e2e8f0",
    },
  },
};

export type AppTheme = typeof darkTheme;

/** Use this instead of Paper's useTheme so the extra POS colours are typed. */
export const useAppTheme = () => useTheme<AppTheme>();
