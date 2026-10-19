import { useEffect, useRef, type ReactNode } from "react";
import { Animated, useWindowDimensions, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "../theme/paperTheme";

/** Pulses everything inside it together while data loads. */
export function Skeleton({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View accessibilityLabel="Loading" accessibilityRole="progressbar" style={[{ opacity: pulse }, style]}>
      {children}
    </Animated.View>
  );
}

type BoneProps = {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** One grey placeholder shape. */
export function Bone({ width = "100%", height, radius = 8, style }: BoneProps) {
  const theme = useAppTheme();
  return <View style={[{ width, height, borderRadius: radius, backgroundColor: theme.colors.surfaceVariant }, style]} />;
}

/** Rows like the menu and order lists: thumbnail + two lines of text. */
export function ListSkeleton({ rows = 6, thumbnail = true }: { rows?: number; thumbnail?: boolean }) {
  return (
    <Skeleton>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="flex-row items-center gap-3 px-4 py-3">
          {thumbnail ? <Bone width={56} height={56} /> : null}
          <View className="flex-1 gap-2">
            <Bone width="60%" height={14} />
            <Bone width="35%" height={12} />
          </View>
        </View>
      ))}
    </Skeleton>
  );
}

/** Cards like the History list. */
export function CardListSkeleton({ cards = 4 }: { cards?: number }) {
  const theme = useAppTheme();
  return (
    <Skeleton style={{ gap: 12 }}>
      {Array.from({ length: cards }, (_, i) => (
        <View
          key={i}
          className="gap-3 rounded-2xl p-4"
          style={{ borderWidth: 1, borderColor: theme.colors.outlineVariant }}
        >
          <View className="flex-row items-center justify-between">
            <Bone width="40%" height={16} />
            <Bone width={72} height={22} radius={11} />
          </View>
          <Bone width="70%" height={12} />
          <Bone width="45%" height={12} />
        </View>
      ))}
    </Skeleton>
  );
}

/** The Dine-In screen while tables load: info line, filter chips, a grid of tables. */
export function FloorPlanSkeleton() {
  const { width } = useWindowDimensions();
  const gap = 12;
  const columns = 3;
  const size = (width - 32 - gap * (columns - 1)) / columns;

  return (
    <Skeleton style={{ gap: 12, paddingHorizontal: 16, paddingTop: 4 }}>
      <Bone width="45%" height={14} />
      <View className="flex-row gap-2">
        {[70, 92, 84, 88].map((w, i) => (
          <Bone key={i} width={w} height={32} radius={16} />
        ))}
      </View>
      <View className="flex-row flex-wrap" style={{ gap }}>
        {Array.from({ length: 9 }, (_, i) => (
          <Bone key={i} width={size} height={size} radius={16} />
        ))}
      </View>
    </Skeleton>
  );
}

/** Top of a table screen: status pill, status chips, the Add order / Orders switch. */
export function TableHeaderSkeleton() {
  return (
    <Skeleton style={{ gap: 12, paddingHorizontal: 16, paddingBottom: 12 }}>
      <Bone width={120} height={24} radius={12} />
      <View className="flex-row gap-2">
        {[84, 84, 80, 80].map((w, i) => (
          <Bone key={i} width={w} height={32} radius={16} />
        ))}
      </View>
      <Bone height={40} radius={20} />
    </Skeleton>
  );
}