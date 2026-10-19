import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Modal, Portal } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../../../shared/api/client";
import { usePosAuth } from "../../auth/PosAuthProvider";
import { useOrgOutlets } from "../../hooks/useAdmin";
import { useAdminPalette } from "../../../../shared/theme/adminPalette";
import { useDashboardPalette } from "../../../../shared/theme/dashboardPalette";
import type { OrgOutlet } from "../../types/admin";
import { AdminButton, AdminEmpty, AdminError, AdminHero } from "../../../../shared/components/AdminUI";

/** Switch to an outlet; remembers which one is loading and the last error. */
function useSwitchOutlet() {
  const { switchOutlet } = usePosAuth();
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const switchTo = async (outlet: OrgOutlet): Promise<boolean> => {
    setSwitching(outlet.id);
    setError(null);
    try {
      await switchOutlet({ id: outlet.id, name: outlet.name });
      return true;
    } catch (e) {
      setError(getErrorMessage(e, "Couldn't open this outlet. Please try again."));
      return false;
    } finally {
      setSwitching(null);
    }
  };

  return { switching, error, switchTo };
}

/** Sidebar box for the Owner: the outlet every page shows; tap to pick another one. */
export function OutletSwitcher() {
  const p = useAdminPalette();
  const { activeOutlet } = usePosAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Outlet: ${activeOutlet?.name ?? "none"}. Tap to switch outlet.`}
        className="flex-row items-center gap-3 rounded-lg px-3 py-2.5"
        style={({ pressed }) => ({ borderWidth: 1, borderColor: p.border, backgroundColor: pressed ? p.item.pressed : "transparent" })}
      >
        <MaterialCommunityIcons name="storefront-outline" size={18} color={p.item.icon} />
        <View className="flex-1">
          <Text style={{ color: p.user.muted, fontSize: 10, fontWeight: "600", letterSpacing: 0.8 }}>OUTLET</Text>
          <Text numberOfLines={1} style={{ color: p.user.name, fontSize: 13, fontWeight: "600" }}>
            {activeOutlet?.name ?? "Choose outlet"}
          </Text>
        </View>
        <MaterialCommunityIcons name="unfold-more-horizontal" size={18} color={p.item.icon} />
      </Pressable>
      <OutletPickerDialog visible={open} onDismiss={() => setOpen(false)} />
    </>
  );
}

/** Pop-up list of every outlet of the organisation (search when there are many). */
function OutletPickerDialog({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const d = useDashboardPalette();
  const outlets = useOrgOutlets();
  const { activeOutletId } = usePosAuth();
  const { switching, error, switchTo } = useSwitchOutlet();
  const [search, setSearch] = useState("");

  const list = outlets.data ?? [];
  const q = search.trim().toLowerCase();
  const shown = q ? list.filter((o) => o.name.toLowerCase().includes(q) || (o.address ?? "").toLowerCase().includes(q)) : list;

  const pick = async (outlet: OrgOutlet) => {
    if (outlet.id === activeOutletId) return onDismiss();
    if (await switchTo(outlet)) onDismiss();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={() => !switching && onDismiss()}
        dismissable={!switching}
        style={{ paddingHorizontal: 16 }}
        contentContainerStyle={{
          alignSelf: "center",
          width: "100%",
          maxWidth: 420,
          maxHeight: "80%",
          backgroundColor: d.card,
          borderWidth: 1,
          borderColor: d.border,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 1, borderColor: d.border }}>
          <Text style={{ color: d.text, fontSize: 16, fontWeight: "700" }}>Switch outlet</Text>
          <Pressable onPress={onDismiss} disabled={!!switching} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
            <MaterialCommunityIcons name="close" size={20} color={d.muted} />
          </Pressable>
        </View>

        {list.length > 6 ? (
          <View className="flex-row items-center gap-2 px-4" style={{ borderBottomWidth: 1, borderColor: d.border }}>
            <MaterialCommunityIcons name="magnify" size={16} color={d.input.placeholder} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search outlets..."
              placeholderTextColor={d.input.placeholder}
              style={{ flex: 1, color: d.input.text, fontSize: 14, paddingVertical: 10 }}
            />
          </View>
        ) : null}

        {error ? (
          <View className="px-4 pt-3">
            <AdminError text={error} />
          </View>
        ) : null}

        {outlets.isLoading ? (
          <ActivityIndicator color={d.link} style={{ margin: 24 }} />
        ) : outlets.error ? (
          <View className="p-4">
            <AdminError text={getErrorMessage(outlets.error, "Couldn't load your outlets.")} />
          </View>
        ) : (
          <FlatList
            data={shown}
            keyExtractor={(o) => o.id}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={{ color: d.muted, fontSize: 13, padding: 12 }}>No outlets found.</Text>}
            renderItem={({ item }) => (
              <OutletRow outlet={item} active={item.id === activeOutletId} loading={switching === item.id} disabled={!!switching} onPress={() => pick(item)} />
            )}
          />
        )}
      </Modal>
    </Portal>
  );
}

/** One outlet: name, address, "Current" / "Inactive". */
function OutletRow({
  outlet,
  active,
  loading,
  disabled,
  onPress,
}: {
  outlet: OrgOutlet;
  active: boolean;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const d = useDashboardPalette();
  const inactive = !outlet.isActive;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || inactive}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: disabled || inactive }}
      className="flex-row items-center gap-3 rounded-xl p-3.5"
      style={({ pressed }) => ({
        backgroundColor: active ? d.brand.tile : pressed ? d.pressed : d.card,
        borderWidth: 1,
        borderColor: active ? d.brand.edge : d.border,
        opacity: inactive ? 0.5 : 1,
      })}
    >
      <View className="h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: active ? d.card : d.brand.tile }}>
        <MaterialCommunityIcons name="storefront-outline" size={20} color={d.brand.icon} />
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} style={{ color: d.text, fontSize: 14, fontWeight: "600" }}>
          {outlet.name}
        </Text>
        {outlet.address ? (
          <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12 }}>
            {outlet.address}
          </Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={d.link} />
      ) : active ? (
        <Text style={{ color: d.link, fontSize: 11, fontWeight: "700" }}>CURRENT</Text>
      ) : inactive ? (
        <Text style={{ color: d.muted, fontSize: 11, fontWeight: "700" }}>INACTIVE</Text>
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={18} color={d.muted} />
      )}
    </Pressable>
  );
}

/**
 * First screen for an Owner with several outlets (the server doesn't pick one at login):
 * choose the outlet to work in. It can be changed any time from the menu.
 */
export function OutletGate() {
  const d = useDashboardPalette();
  const insets = useSafeAreaInsets();
  const { user, logout } = usePosAuth();
  const outlets = useOrgOutlets();
  const { switching, error, switchTo } = useSwitchOutlet();
  const [loggingOut, setLoggingOut] = useState(false);

  const list = outlets.data ?? [];

  return (
    <View className="flex-1" style={{ paddingTop: insets.top }}>
      <FlatList
        data={outlets.isLoading ? [] : list}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{
          gap: 10,
          padding: 16,
          paddingBottom: insets.bottom + 32,
          width: "100%",
          maxWidth: 560,
          alignSelf: "center",
        }}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 6 }}>
            <AdminHero title={`Welcome${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`} subtitle="Choose the outlet you want to work in" />
            {error ? <AdminError text={error} /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <OutletRow outlet={item} active={false} loading={switching === item.id} disabled={!!switching} onPress={() => switchTo(item)} />
        )}
        ListEmptyComponent={
          outlets.isLoading ? (
            <ActivityIndicator color={d.link} style={{ marginTop: 32 }} />
          ) : outlets.error ? (
            <AdminEmpty icon="alert-circle-outline" text={getErrorMessage(outlets.error, "Couldn't load your outlets.")} error />
          ) : (
            <AdminEmpty icon="storefront-outline" text="No outlets yet. Create one on the web first." />
          )
        }
        ListFooterComponent={
          <View className="mt-4 items-center">
            <AdminButton
              label="Logout"
              icon="logout"
              loading={loggingOut}
              onPress={async () => {
                setLoggingOut(true);
                await logout();
              }}
            />
          </View>
        }
      />
    </View>
  );
}