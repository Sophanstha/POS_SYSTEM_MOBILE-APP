import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../../shared/api/client";
import { AdminEmpty, AdminHero, AdminSearch, AdminStat, PickerField, useAdminContentWidth } from "../../../shared/components/AdminUI";
import { usePosAuth } from "../auth/PosAuthProvider";
import { useOrgOutlets, useOrgRoles, useRolePermissions, useStaffAt } from "../hooks/useAdmin";
import { useDashboardPalette } from "../../../shared/theme/dashboardPalette";
import type { OrgRole, PermissionsByModule } from "../types/admin";

/** Same grouping as the web Roles page. */
const MODULE_GROUPS: { module: string; name: string; resources: { code: string; name: string }[] }[] = [
  { module: "pos", name: "POS Operations", resources: [{ code: "billing", name: "Billing" }, { code: "payments", name: "Payments" }] },
  { module: "restaurant", name: "Restaurant / Dining", resources: [{ code: "tables", name: "Tables" }, { code: "kot", name: "KOT (Kitchen Order Tickets)" }] },
  {
    module: "inventory",
    name: "Inventory Management",
    resources: [
      { code: "categories", name: "Categories" },
      { code: "products", name: "Products" },
      { code: "stock", name: "Stock Tracking" },
      { code: "recipes", name: "Recipes" },
    ],
  },
  { module: "core", name: "Core Administration", resources: [{ code: "outlets", name: "Outlets" }, { code: "users", name: "Users" }, { code: "roles", name: "Roles" }] },
];

const ACTIONS = [
  { code: "create", short: "C", name: "Create" },
  { code: "read", short: "R", name: "View" },
  { code: "update", short: "U", name: "Edit" },
  { code: "delete", short: "D", name: "Delete" },
];

/** How a staff member's role name matches a role (web: "Kitchen" counts as Kitchen Crew). */
const sameRole = (staffRole: string, roleName: string) => {
  const s = staffRole.toLowerCase();
  const r = roleName.toLowerCase();
  if (r === "manager") return s === "manager" || s === "branch manager";
  if (r === "kitchen crew") return s === "kitchen" || s === "kitchen crew";
  return s === r;
};

/**
 * Owner "Organization Roles", like the web: every role, how many people have it at the
 * chosen outlet, and (tap a role) what it may create / view / edit / delete there.
 */
export default function OwnerRolesScreen() {
  const d = useDashboardPalette();
  const insets = useSafeAreaInsets();
  const contentWidth = useAdminContentWidth();
  const { activeOutletId } = usePosAuth();

  const [outletId, setOutletId] = useState<string | null>(activeOutletId);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  const outlets = useOrgOutlets();
  const roles = useOrgRoles();
  const staff = useStaffAt(outletId);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (roles.data ?? []).filter((r) => !q || r.name.toLowerCase().includes(q));
  }, [roles.data, search]);

  const statBasis = contentWidth >= 560 ? "45%" : "100%";
  const assigned = (role: OrgRole) => (staff.data ?? []).filter((s) => sameRole(s.role, role.name)).length;

  const refresh = async () => {
    setPulling(true);
    await Promise.all([roles.refetch(), staff.refetch()]);
    setPulling(false);
  };

  const header = (
    <View style={{ gap: 20, marginBottom: 12 }}>
      <AdminHero title="Organization Roles" subtitle="What each role may do at an outlet" />

      <PickerField
        icon="storefront-outline"
        placeholder="Select outlet"
        value={outletId ?? ""}
        searchable={(outlets.data?.length ?? 0) > 6}
        searchPlaceholder="Search outlets..."
        options={(outlets.data ?? []).map((o) => ({ value: o.id, label: o.name, hint: o.isActive ? undefined : "Inactive" }))}
        onChange={(id) => {
          setOutletId(id);
          setExpanded(null);
        }}
      />

      {roles.isLoading ? null : (
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          <AdminStat basis={statBasis} tone="slate" icon="shield-account-outline" label="Total Roles" value={String((roles.data ?? []).length)} />
          <AdminStat basis={statBasis} tone="emerald" icon="account-group-outline" label="People at this outlet" value={staff.isLoading ? "…" : String((staff.data ?? []).length)} />
        </View>
      )}

      <AdminSearch value={search} onChangeText={setSearch} placeholder="Search roles..." />
    </View>
  );

  return (
    <View className="flex-1">
      <FlatList
        data={roles.isLoading ? [] : list}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={header}
        contentContainerStyle={{
          gap: 10,
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
          width: "100%",
          maxWidth: 900,
          alignSelf: "center",
        }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}
        renderItem={({ item }) => (
          <RoleCard
            role={item}
            outletId={outletId}
            count={staff.isLoading ? null : assigned(item)}
            expanded={expanded === item.id}
            onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
          />
        )}
        ListEmptyComponent={
          roles.isLoading ? (
            <ActivityIndicator color={d.link} style={{ marginTop: 24 }} />
          ) : roles.error ? (
            <AdminEmpty icon="alert-circle-outline" text={getErrorMessage(roles.error, "Failed to load roles.")} error />
          ) : (
            <AdminEmpty icon="shield-outline" text="No roles match your search." />
          )
        }
        ListFooterComponent={
          <Text style={{ color: d.muted, fontSize: 11, textAlign: "center", marginTop: 8 }}>View only, like the web Roles page.</Text>
        }
      />
    </View>
  );
}

/** One role: name, people with it at the outlet; tap to see its permissions. */
function RoleCard({
  role,
  outletId,
  count,
  expanded,
  onToggle,
}: {
  role: OrgRole;
  outletId: string | null;
  count: number | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const d = useDashboardPalette();
  const permissions = useRolePermissions(expanded ? role.id : null, outletId);

  return (
    <View className="overflow-hidden rounded-xl" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="flex-row items-center gap-3 p-4"
        style={({ pressed }) => ({ backgroundColor: pressed ? d.pressed : "transparent" })}
      >
        <View className="h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: d.brand.tile }}>
          <MaterialCommunityIcons name="shield-account-outline" size={20} color={d.brand.icon} />
        </View>
        <View className="flex-1">
          <Text style={{ color: d.text, fontSize: 14, fontWeight: "600" }}>{role.name}</Text>
          <View className="mt-0.5 flex-row items-center gap-1">
            <MaterialCommunityIcons name="account-multiple-outline" size={13} color={d.muted} />
            <Text style={{ color: d.muted, fontSize: 12 }}>{count === null ? "…" : `${count} assigned`}</Text>
          </View>
        </View>
        <MaterialCommunityIcons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={d.muted} />
      </Pressable>

      {expanded ? (
        <View className="gap-4 p-4" style={{ backgroundColor: d.rowExpanded, borderTopWidth: 1, borderColor: d.border }}>
          {permissions.isLoading ? (
            <ActivityIndicator color={d.link} style={{ alignSelf: "flex-start" }} />
          ) : permissions.error ? (
            <Text style={{ color: d.error.text, fontSize: 12 }}>{getErrorMessage(permissions.error, "Failed to load permissions.")}</Text>
          ) : (
            <PermissionMatrix permissions={permissions.data ?? {}} />
          )}
        </View>
      ) : null}
    </View>
  );
}

/** Per module: each resource with Create / View / Edit / Delete (green = allowed). */
function PermissionMatrix({ permissions }: { permissions: PermissionsByModule }) {
  const d = useDashboardPalette();
  const allowed = (module: string, resource: string, action: string) =>
    (permissions[module] ?? []).find((p) => p.resource === resource && p.action === action)?.isEnabled ?? false;

  return (
    <>
      <View className="flex-row flex-wrap" style={{ columnGap: 12, rowGap: 4 }}>
        {ACTIONS.map((a) => (
          <Text key={a.code} style={{ color: d.muted, fontSize: 11 }}>
            <Text style={{ fontWeight: "700" }}>{a.short}</Text> = {a.name}
          </Text>
        ))}
      </View>
      {MODULE_GROUPS.map((group) => (
        <View key={group.module} className="gap-2">
          <Text style={{ color: d.sub, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }}>{group.name.toUpperCase()}</Text>
          {group.resources.map((res) => (
            <View key={res.code} className="flex-row items-center justify-between gap-3 rounded-lg px-3 py-2.5" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
              <Text style={{ flex: 1, color: d.title, fontSize: 13, fontWeight: "500" }}>{res.name}</Text>
              <View className="flex-row" style={{ gap: 6 }}>
                {ACTIONS.map((a) => {
                  const on = allowed(group.module, res.code, a.code);
                  return (
                    <View
                      key={a.code}
                      accessible
                      accessibilityLabel={`${res.name} ${a.name}: ${on ? "allowed" : "not allowed"}`}
                      className="h-7 w-7 items-center justify-center rounded-md"
                      style={{ backgroundColor: on ? d.brand.tile : d.skeleton, borderWidth: 1, borderColor: on ? d.brand.edge : d.border }}
                    >
                      <Text style={{ color: on ? d.link : d.muted, fontSize: 11, fontWeight: "800" }}>{a.short}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}
