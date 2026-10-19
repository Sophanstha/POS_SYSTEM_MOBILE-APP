import { useThemeMode } from "../context/ThemeContext";

/**
 * Colours of the web Manager / Owner sidebar (t/[tenantSlug]/_components/AdminNavbar.tsx).
 * Light is the web exactly (white, slate, emerald); dark is the same layout on zinc.
 */
const LIGHT = {
  bg: "#ffffff",
  border: "#e2e8f0",
  brand: "#1e293b",
  close: "#94a3b8",
  item: { text: "#475569", icon: "#94a3b8", pressed: "#f1f5f9" },
  active: { bg: "#059669", text: "#ffffff" },
  user: { name: "#1e293b", muted: "#64748b" },
  logout: { text: "#f43f5e", icon: "#fb7185", pressed: "#fff1f2" },
  backdrop: "rgba(15,23,42,0.4)",
};

const DARK: typeof LIGHT = {
  bg: "#18181b",
  border: "#27272a",
  brand: "#fafafa",
  close: "#71717a",
  item: { text: "#a1a1aa", icon: "#71717a", pressed: "#27272a" },
  active: { bg: "#059669", text: "#ffffff" },
  user: { name: "#fafafa", muted: "#a1a1aa" },
  logout: { text: "#fb7185", icon: "#fb7185", pressed: "rgba(244,63,94,0.12)" },
  backdrop: "rgba(0,0,0,0.6)",
};

export type AdminPalette = typeof LIGHT;

export function useAdminPalette(): AdminPalette {
  const { isDark } = useThemeMode();
  return isDark ? DARK : LIGHT;
}