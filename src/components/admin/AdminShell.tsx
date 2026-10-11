import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, usePathname } from "expo-router";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../context/AuthContext";
import { useThemeMode } from "../../context/ThemeContext";
import { useOrganization } from "../../hooks/useAdmin";
import { useLayout } from "../../hooks/useLayout";
import type { AdminNavItem } from "../../navigation/adminNav";
import { useAdminPalette } from "../../theme/adminPalette";

/** Same width as the web sidebar (w-64). */
const SIDEBAR_WIDTH = 256;

const MenuContext = createContext<(() => void) | null>(null);

type AdminShellProps = {
  /** Menu entries; the first one is the home ("Overview"). */
  items: AdminNavItem[];
  children: ReactNode;
};

/**
 * Manager / Owner frame, like the web: a sidebar menu.
 * Phone in portrait: hidden, opened with the ☰ button in the header.
 * Landscape / tablet: always visible on the left.
 */
export default function AdminShell({ items, children }: AdminShellProps) {
  const { isWide } = useLayout();
  const [open, setOpen] = useState(false);

  // Rotating to a wide screen shows the fixed sidebar instead.
  useEffect(() => {
    if (isWide) setOpen(false);
  }, [isWide]);

  if (isWide) {
    return (
      <View className="flex-1 flex-row">
        <Sidebar items={items} />
        <View className="flex-1">{children}</View>
      </View>
    );
  }

  return (
    <MenuContext.Provider value={() => setOpen(true)}>
      <View className="flex-1">
        {children}
        <Drawer open={open} onClose={() => setOpen(false)}>
          <Sidebar items={items} onClose={() => setOpen(false)} />
        </Drawer>
      </View>
    </MenuContext.Provider>
  );
}

/** ☰ button for the header of a main section (only on phones, where the menu is hidden). */
export function MenuButton() {
  const openMenu = useContext(MenuContext);
  const p = useAdminPalette();
  const { isDark } = useThemeMode();
  if (!openMenu) return null;

  return (
    <Pressable
      onPress={openMenu}
      accessibilityRole="button"
      accessibilityLabel="Open navigation menu"
      hitSlop={8}
      className="mr-2 rounded-lg p-1.5"
      style={({ pressed }) => ({ backgroundColor: pressed ? p.item.pressed : "transparent" })}
    >
      <MaterialCommunityIcons name="menu" size={24} color={isDark ? p.brand : p.item.text} />
    </Pressable>
  );
}

/** Slides the menu in from the left over a dimmed backdrop. Back button / backdrop tap closes it. */
function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const p = useAdminPalette();
  const { width } = useLayout();
  const panelWidth = Math.min(SIDEBAR_WIDTH + 24, width * 0.82);
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(progress, { toValue: open ? 1 : 0, duration: open ? 220 : 180, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished && !open) setMounted(false);
      },
    );
  }, [open, progress]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, elevation: 50 }}>
      <Animated.View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: progress }}>
        <Pressable onPress={onClose} accessibilityLabel="Close navigation menu" style={{ flex: 1, backgroundColor: p.backdrop }} />
      </Animated.View>
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: panelWidth,
          transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-panelWidth, 0] }) }],
          elevation: 16,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 16,
          shadowOffset: { width: 4, height: 0 },
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/** Organisation, menu entries, signed-in user, theme and logout. */
function Sidebar({ items, onClose }: { items: AdminNavItem[]; onClose?: () => void }) {
  const p = useAdminPalette();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { user, role, activeOutlet, logout } = useAuth();
  const { isDark, toggleTheme } = useThemeMode();
  const org = useOrganization();
  const { height } = useLayout();
  const [loggingOut, setLoggingOut] = useState(false);

  // Phone in landscape is short: the footer scrolls with the menu instead of taking fixed space.
  const short = height < 500;

  const home = items[0]?.href;
  const isActive = (href: string) => (href === home ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  const go = (href: string) => {
    onClose?.();
    if (pathname === href) return;
    // A menu entry starts that section fresh instead of stacking on top of the last one.
    if (router.canDismiss()) router.dismissAll();
    router.replace(href as never);
  };

  const doLogout = async () => {
    setLoggingOut(true);
    await logout(); // the router leaves this area once signed out
  };

  const footer = (
    <View className="gap-1 px-4 py-4" style={{ borderTopWidth: 1, borderColor: p.border }}>
      <View className="px-4 pb-2">
        <Text numberOfLines={1} style={{ color: p.user.name, fontSize: 13, fontWeight: "600" }}>
          {user?.name ?? ""}
        </Text>
        <Text numberOfLines={1} style={{ color: p.user.muted, fontSize: 12 }}>
          {[role, activeOutlet?.name].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Pressable
        onPress={toggleTheme}
        accessibilityRole="button"
        className="flex-row items-center gap-3 rounded-lg px-4 py-2.5"
        style={({ pressed }) => ({ backgroundColor: pressed ? p.item.pressed : "transparent" })}
      >
        <MaterialCommunityIcons name={isDark ? "white-balance-sunny" : "moon-waning-crescent"} size={18} color={p.item.icon} />
        <Text style={{ color: p.item.text, fontSize: 14, fontWeight: "500" }}>{isDark ? "Light mode" : "Dark mode"}</Text>
      </Pressable>
      <Pressable
        onPress={doLogout}
        disabled={loggingOut}
        accessibilityRole="button"
        className="flex-row items-center gap-3 rounded-lg px-4 py-2.5"
        style={({ pressed }) => ({ backgroundColor: pressed ? p.logout.pressed : "transparent", opacity: loggingOut ? 0.6 : 1 })}
      >
        {loggingOut ? (
          <ActivityIndicator size="small" color={p.logout.icon} />
        ) : (
          <MaterialCommunityIcons name="logout" size={18} color={p.logout.icon} />
        )}
        <Text style={{ color: p.logout.text, fontSize: 14, fontWeight: "500" }}>Logout</Text>
      </Pressable>
    </View>
  );

  return (
    <View
      style={{
        width: onClose ? "100%" : SIDEBAR_WIDTH + insets.left,
        flex: onClose ? 1 : undefined,
        backgroundColor: p.bg,
        borderRightWidth: 1,
        borderColor: p.border,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: onClose ? 0 : insets.left,
      }}
    >
      {/* Brand */}
      <View
        className={`items-center justify-center px-3 ${short ? "py-3" : "py-5"}`}
        style={{ borderBottomWidth: 1, borderColor: p.border, minHeight: short ? 52 : 64 }}
      >
        {org.data?.imageUrl ? (
          <Image
            source={{ uri: org.data.imageUrl }}
            resizeMode="contain"
            accessibilityLabel={org.data.name}
            style={{ width: "80%", height: 56, borderRadius: 6 }}
          />
        ) : (
          <Text numberOfLines={2} style={{ color: p.brand, fontSize: 15, fontWeight: "600", textAlign: "center", paddingHorizontal: 28 }}>
            {org.data?.name ?? activeOutlet?.name ?? ""}
          </Text>
        )}
        {onClose ? (
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close navigation menu"
            hitSlop={8}
            className="absolute right-3 rounded-lg p-1.5"
            style={({ pressed }) => ({ backgroundColor: pressed ? p.item.pressed : "transparent" })}
          >
            <MaterialCommunityIcons name="close" size={20} color={p.close} />
          </Pressable>
        ) : null}
      </View>

      {/* Navigation */}
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 16, gap: 6 }}>
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Pressable
              key={item.href}
              onPress={() => go(item.href)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className="flex-row items-center gap-3 rounded-lg px-4 py-3"
              style={({ pressed }) => ({
                backgroundColor: active ? p.active.bg : pressed ? p.item.pressed : "transparent",
                elevation: active ? 1 : 0,
              })}
            >
              <MaterialCommunityIcons name={item.icon} size={18} color={active ? p.active.text : p.item.icon} />
              <Text style={{ color: active ? p.active.text : p.item.text, fontSize: 14, fontWeight: "500" }}>{item.label}</Text>
            </Pressable>
          );
        })}
        {short ? <View style={{ marginHorizontal: -12, marginTop: 10 }}>{footer}</View> : null}
      </ScrollView>

      {short ? null : footer}
    </View>
  );
}