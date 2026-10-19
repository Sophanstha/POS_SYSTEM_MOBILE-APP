import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Animated, View } from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useConnection } from "../hooks/useConnection";
import { useAppTheme } from "../theme/paperTheme";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const BACK_ONLINE_MS = 2500;

/**
 * Floating pill at the bottom of every screen: red while offline / the server is
 * unreachable, green "Back online" for a moment when it recovers. Taps go through it.
 */
export default function ConnectionBanner() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const connection = useConnection();
  const [backOnline, setBackOnline] = useState(false);
  const wasDown = useRef(false);
  const shown = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (connection !== "online") {
      wasDown.current = true;
      setBackOnline(false);
      return;
    }
    if (!wasDown.current) return;
    wasDown.current = false;
    setBackOnline(true);
    const timer = setTimeout(() => setBackOnline(false), BACK_ONLINE_MS);
    return () => clearTimeout(timer);
  }, [connection]);

  const visible = connection !== "online" || backOnline;

  useEffect(() => {
    Animated.timing(shown, { toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [visible, shown]);

  const info: { icon: IconName; text: string; color: string } =
    connection === "offline"
      ? { icon: "wifi-off", text: "No internet connection", color: theme.colors.error }
      : connection === "serverDown"
        ? { icon: "server-off", text: "Can't reach the server. Retrying…", color: theme.colors.error }
        : { icon: "check-circle-outline", text: "Back online", color: theme.colors.success };

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: insets.bottom + 12,
        alignItems: "center",
        pointerEvents: "none",
        opacity: shown,
        transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
      }}
    >
      <View
        className="flex-row items-center gap-2 rounded-full px-4 py-2.5"
        style={{
          backgroundColor: info.color,
          elevation: 6,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <MaterialCommunityIcons name={info.icon} size={18} color="#ffffff" />
        <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>{info.text}</Text>
      </View>
    </Animated.View>
  );
}