import { useThemeMode } from "../context/ThemeContext";

/**
 * The web POS order screen's colours (pos/_components/order.tsx), used by the
 * landscape / tablet layout so it looks like the web. Dark: black + gold.
 * Light: white menu with green cards, green "Active Order" sidebar.
 */
const DARK = {
  accent: "#e5b83b",
  accentText: "#0c0c0d",
  pageBg: "#0c0c0d",
  surface: "#141416",
  surface2: "#1c1c1e",
  skeleton: "#1c1c1e",
  border: "#27272a",
  textPrim: "#ffffff",
  textMuted: "#a1a1aa",
  textFaint: "#52525b",
  /** Over a card photo when the item is in the order. */
  inCartOverlay: "rgba(12,12,13,0.6)",
  /** Bottom half of a product card. */
  card: { footer: "transparent", title: "#ffffff", muted: "#a1a1aa", price: "#e5b83b" },
  sidebar: {
    bg: "#0c0c0d",
    text: "#ffffff",
    muted: "#a1a1aa",
    faint: "#52525b",
    border: "#27272a",
    surface: "#141416",
    surface2: "#1c1c1e",
    accent: "#e5b83b",
    accentText: "#0c0c0d",
  },
  /** Table screen header bar. */
  header: {
    bg: "#0c0c0d",
    border: "#27272a",
    tab: "#71717a",
    tabActive: "#e5b83b",
    groupBg: "#141416",
    groupBorder: "#27272a",
    option: "#71717a",
    optionActive: "#ffffff",
    optionActiveBg: "#27272a",
    badgeBg: "#e5b83b",
    badgeText: "#0c0c0d",
  },
  /** Home screen (web: pos/cashier/page.tsx). */
  home: {
    bg: "#0c0c0d",
    gradient: "linear-gradient(135deg, #0c0c0d 0%, #0c0c0d 100%)",
    title: "#ffffff",
    subtitle: "#a1a1aa",
    card: "#18181b",
    cardBorder: "#27272a",
    iconCircle: "rgba(229,184,59,0.05)",
    iconCircleBorder: "rgba(229,184,59,0.2)",
    buttonBg: "#141416",
    buttonBorder: "#27272a",
    buttonText: "#a1a1aa",
  },
  /** Dine-In top bar (web: pos/cashier/dinein/page.tsx). */
  bar: {
    bg: "#141416",
    border: "#27272a",
    text: "#a1a1aa",
    chipBg: "#0c0c0d",
    chipBorder: "#171717",
    chipText: "#a1a1aa",
    chipActiveBorder: "#e5b83b",
    chipActiveText: "#ffffff",
    buttonBg: "#141416",
    buttonBorder: "#262626",
    buttonText: "#a1a1aa",
    buttonActiveBg: "#e5b83b",
    buttonActiveText: "#0c0c0d",
  },
};

const LIGHT: typeof DARK = {
  accent: "#059669",
  accentText: "#ffffff",
  pageBg: "#ffffff",
  surface: "#ffffff",
  surface2: "#d1fae5",
  skeleton: "#e2e8f0",
  border: "#e2e8f0",
  textPrim: "#1e293b",
  textMuted: "#64748b",
  textFaint: "#94a3b8",
  inCartOverlay: "rgba(5,150,105,0.15)",
  card: { footer: "#059669", title: "#ffffff", muted: "rgba(255,255,255,0.75)", price: "#ffffff" },
  sidebar: {
    bg: "#059669",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.75)",
    faint: "rgba(255,255,255,0.55)",
    border: "rgba(255,255,255,0.18)",
    surface: "rgba(255,255,255,0.12)",
    surface2: "rgba(255,255,255,0.18)",
    accent: "#ffffff",
    accentText: "#059669",
  },
  header: {
    bg: "#059669",
    border: "#047857",
    tab: "rgba(255,255,255,0.7)",
    tabActive: "#ffffff",
    groupBg: "rgba(255,255,255,0.2)",
    groupBorder: "rgba(255,255,255,0.3)",
    option: "rgba(255,255,255,0.7)",
    optionActive: "#065f46",
    optionActiveBg: "#ffffff",
    badgeBg: "#ffffff",
    badgeText: "#059669",
  },
  home: {
    bg: "#0e6e4d",
    gradient: "linear-gradient(135deg, #18a172 0%, #0e6e4d 55%, #073822 100%)",
    title: "#ffffff",
    subtitle: "rgba(255,255,255,0.75)",
    card: "#e5e7eb",
    cardBorder: "transparent",
    iconCircle: "#ffffff",
    iconCircleBorder: "#059669",
    buttonBg: "rgba(255,255,255,0.12)",
    buttonBorder: "rgba(255,255,255,0.25)",
    buttonText: "#ffffff",
  },
  bar: {
    bg: "#059669",
    border: "#047857",
    text: "rgba(255,255,255,0.85)",
    chipBg: "rgba(4,120,87,0.6)",
    chipBorder: "rgba(5,150,105,0.3)",
    chipText: "#ecfdf5",
    chipActiveBorder: "#ffffff",
    chipActiveText: "#ffffff",
    buttonBg: "#047857",
    buttonBorder: "#059669",
    buttonText: "#ffffff",
    buttonActiveBg: "#ffffff",
    buttonActiveText: "#047857",
  },
};

export type WebPalette = typeof DARK;

export function useWebPalette(): WebPalette {
  const { isDark } = useThemeMode();
  return isDark ? DARK : LIGHT;
}
