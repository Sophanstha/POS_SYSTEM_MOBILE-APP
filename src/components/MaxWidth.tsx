import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

type MaxWidthProps = {
  /** Widest the content may get, e.g. 480 for forms. */
  width?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Keeps content to a readable width, centered, on tablets and landscape. Full width on phones. */
export default function MaxWidth({ width = 480, style, children }: MaxWidthProps) {
  return <View style={[{ width: "100%", maxWidth: width, alignSelf: "center" }, style]}>{children}</View>;
}
