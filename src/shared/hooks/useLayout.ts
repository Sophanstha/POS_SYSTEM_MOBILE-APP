import { useWindowDimensions } from "react-native";

/**
 * compact  – under 600 wide: phone in portrait (the layout the app was built for)
 * medium   – 600 to 1023: phone in landscape, small tablet
 * expanded – 1024 and up: tablet / iPad in landscape
 */
export type SizeClass = "compact" | "medium" | "expanded";

export const BREAKPOINTS = { medium: 600, expanded: 1024 } as const;

/** Screen size and orientation. Updates live when the device rotates. */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const size: SizeClass =
    width >= BREAKPOINTS.expanded ? "expanded" : width >= BREAKPOINTS.medium ? "medium" : "compact";

  return {
    width,
    height,
    size,
    isLandscape: width > height,
    /** Phone in portrait: keep the phone layout. */
    isCompact: size === "compact",
    /** Room for side-by-side panes and centered dialogs. */
    isWide: size !== "compact",
    /** A tablet in either orientation (its short side is still 600+). */
    isTablet: Math.min(width, height) >= BREAKPOINTS.medium,
  };
}
