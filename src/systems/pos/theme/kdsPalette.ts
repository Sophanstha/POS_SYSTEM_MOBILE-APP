import { useThemeMode } from "../../../shared/context/ThemeContext";

/** Colours of the web Kitchen Display (pos/kitchen/kdsBoard.tsx): sticky notes on a grey board. */
const DARK = {
  boardBg: "#111113",
  headerBg: "#18181b",
  headerBorder: "#27272a",
  title: "#ffffff",
  muted: "#52525b",
  button: { bg: "#27272a", border: "#3f3f46", text: "#a1a1aa" },
  tabsBg: "#141416",
  tabActiveBg: "#27272a",
  /** Sticky note per stage; "urgent" = new and waiting 10+ minutes. */
  note: {
    new: { bg: "#21201a", border: "rgba(120,53,15,0.4)", tape: "rgba(229,184,59,0.2)" },
    urgent: { bg: "#2a1a1a", border: "rgba(127,29,29,0.4)", tape: "rgba(239,68,68,0.3)" },
    preparing: { bg: "#17213a", border: "rgba(30,58,138,0.4)", tape: "rgba(59,130,246,0.3)" },
    ready: { bg: "#1a2e1f", border: "rgba(6,78,59,0.4)", tape: "rgba(34,197,94,0.3)" },
  },
  noteTitle: "#ffffff",
  noteText: "#c4c4c8",
  qty: { text: "#a1a1aa", bg: "rgba(0,0,0,0.2)", border: "rgba(255,255,255,0.1)" },
  divider: "rgba(255,255,255,0.08)",
  startButton: { bg: "rgba(0,0,0,0.2)", border: "rgba(255,255,255,0.1)", text: "#a1a1aa" },
  doneText: "#0a1a0f",
  readyButton: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)", text: "#4ade80" },
  /** "Report Inventory Wastage" dialog. */
  modal: {
    bg: "#1c1c1f",
    border: "#3f3f46",
    headerBg: "#232326",
    headerBorder: "#27272a",
    title: "#ffffff",
    close: "#71717a",
    label: "#a1a1aa",
    input: { bg: "#18181b", border: "#3f3f46", focus: "rgba(229,184,59,0.6)", text: "#ffffff", placeholder: "#71717a" },
    tabActive: { bg: "rgba(229,184,59,0.2)", border: "rgba(229,184,59,0.5)", text: "#e5b83b" },
    tabIdle: { border: "#3f3f46", text: "#a1a1aa" },
    rowActive: "rgba(229,184,59,0.12)",
    check: "#e5b83b",
    rowBorder: "#27272a",
    cancel: { border: "#3f3f46", text: "#a1a1aa" },
  },
  column: {
    new: { bg: "rgba(229,184,59,0.08)", border: "rgba(229,184,59,0.15)", text: "#ffffff", countBg: "rgba(229,184,59,0.15)", countText: "#e5b83b" },
    preparing: { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.15)", text: "#ffffff", countBg: "rgba(59,130,246,0.15)", countText: "#60a5fa" },
    ready: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.15)", text: "#ffffff", countBg: "rgba(34,197,94,0.15)", countText: "#4ade80" },
  },
};

const LIGHT: typeof DARK = {
  boardBg: "#f4f4f5",
  headerBg: "#ffffff",
  headerBorder: "#e5e5e5",
  title: "#171717",
  muted: "#a3a3a3",
  button: { bg: "#ffffff", border: "#e5e5e5", text: "#525252" },
  tabsBg: "#f5f5f5",
  tabActiveBg: "#ffffff",
  note: {
    new: { bg: "#fffde7", border: "#fde68a", tape: "rgba(229,184,59,0.2)" },
    urgent: { bg: "#ffebee", border: "#fecaca", tape: "rgba(239,68,68,0.3)" },
    preparing: { bg: "#e3f2fd", border: "#bfdbfe", tape: "rgba(59,130,246,0.3)" },
    ready: { bg: "#e8f5e9", border: "#a7f3d0", tape: "rgba(34,197,94,0.3)" },
  },
  noteTitle: "#171717",
  noteText: "#262626",
  qty: { text: "#525252", bg: "rgba(0,0,0,0.05)", border: "rgba(0,0,0,0.1)" },
  divider: "rgba(0,0,0,0.08)",
  startButton: { bg: "rgba(255,255,255,0.6)", border: "rgba(0,0,0,0.1)", text: "#404040" },
  doneText: "#ffffff",
  readyButton: { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
  modal: {
    bg: "#ffffff",
    border: "#e5e5e5",
    headerBg: "#fafafa",
    headerBorder: "#e5e5e5",
    title: "#171717",
    close: "#a3a3a3",
    label: "#737373",
    input: { bg: "#ffffff", border: "#e5e5e5", focus: "#a3a3a3", text: "#262626", placeholder: "#a3a3a3" },
    tabActive: { bg: "#262626", border: "#262626", text: "#ffffff" },
    tabIdle: { border: "#e5e5e5", text: "#737373" },
    rowActive: "#f5f5f5",
    check: "#262626",
    rowBorder: "#f5f5f5",
    cancel: { border: "#e5e5e5", text: "#525252" },
  },
  column: {
    new: { bg: "rgba(229,184,59,0.12)", border: "rgba(229,184,59,0.25)", text: "#451a03", countBg: "rgba(229,184,59,0.2)", countText: "#92400e" },
    preparing: { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.25)", text: "#172554", countBg: "rgba(59,130,246,0.2)", countText: "#1e40af" },
    ready: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.25)", text: "#052e16", countBg: "rgba(34,197,94,0.2)", countText: "#166534" },
  },
};

export type KdsPalette = typeof DARK;

export function useKdsPalette(): KdsPalette {
  const { isDark } = useThemeMode();
  return isDark ? DARK : LIGHT;
}

/** Same in both themes. */
export const KDS = {
  green: "#22c55e",
  blue: "#2563eb",
  red: "#ef4444",
  gold: "#e5b83b",
  dineInText: "#60a5fa",
};