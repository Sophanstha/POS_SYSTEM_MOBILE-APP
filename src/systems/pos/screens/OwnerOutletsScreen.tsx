import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Switch, Text, View } from "react-native";
import { Snackbar } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../../shared/api/client";
import {
  AdminButton,
  AdminDialog,
  AdminEmpty,
  AdminField,
  AdminHero,
  AdminSearch,
  AdminStat,
  ConfirmDialog,
  useAdminContentWidth,
} from "../../../shared/components/AdminUI";
import { CardListSkeleton } from "../../../shared/components/Skeleton";
import { usePosAuth } from "../auth/PosAuthProvider";
import { useDeleteOrgOutlet, useOrgOutlets, useSaveOrgOutlet, useSetKitchenWorkflow, useSetOrgOutletActive } from "../hooks/useAdmin";
import { useDashboardPalette } from "../../../shared/theme/dashboardPalette";
import type { OrgOutlet, OrgOutletForm } from "../types/admin";

const EMPTY_FORM: OrgOutletForm = { name: "", phone: "", address: "" };

/**
 * Owner "Outlets", like the web: totals, search, add / edit / delete outlets,
 * switch them active or inactive, and whether orders go through the kitchen screen.
 */
export default function OwnerOutletsScreen() {
  const d = useDashboardPalette();
  const insets = useSafeAreaInsets();
  const contentWidth = useAdminContentWidth();
  const { activeOutletId, renameOutlet } = usePosAuth();

  const outlets = useOrgOutlets();
  const save = useSaveOrgOutlet();
  const setActive = useSetOrgOutletActive();
  const setKitchen = useSetKitchenWorkflow();
  const remove = useDeleteOrgOutlet();

  const [search, setSearch] = useState("");
  const [pulling, setPulling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrgOutlet | null>(null);
  const [form, setForm] = useState<OrgOutletForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrgOutlet | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<OrgOutlet | null>(null);

  const list = useMemo(() => outlets.data ?? [], [outlets.data]);
  const active = list.filter((o) => o.isActive).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => o.name.toLowerCase().includes(q) || (o.phone ?? "").includes(q) || (o.address ?? "").toLowerCase().includes(q));
  }, [list, search]);

  const statBasis = contentWidth >= 560 ? "30%" : "100%";

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (outlet: OrgOutlet) => {
    setEditing(outlet);
    setForm({ name: outlet.name, phone: outlet.phone ?? "", address: outlet.address ?? "" });
    setFormError(null);
    setDialogOpen(true);
  };

  const submit = () => {
    const trimmed = { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() };
    if (!trimmed.name) return setFormError("Enter the outlet name.");
    if (!trimmed.address) return setFormError("Enter the outlet address.");
    if (trimmed.phone.length > 30) return setFormError("The phone number is too long.");

    setFormError(null);
    save.mutate(
      { outlet: editing, form: trimmed },
      {
        onSuccess: async () => {
          setDialogOpen(false);
          // The outlet you're working in shows its new name in the menu straight away.
          if (editing && editing.id === activeOutletId) await renameOutlet(editing.id, trimmed.name);
          setMessage(editing ? `${trimmed.name} saved` : `${trimmed.name} added`);
        },
        onError: (e) => setFormError(getErrorMessage(e, "Failed to save outlet. Please try again.")),
      },
    );
  };

  const changeActive = (outlet: OrgOutlet, isActive: boolean) =>
    setActive.mutate(
      { outletId: outlet.id, isActive },
      {
        onSuccess: () => setMessage(`${outlet.name} is now ${isActive ? "active" : "inactive"}`),
        onError: (e) => setMessage(getErrorMessage(e, "Failed to update status. Please try again.")),
        onSettled: () => setDeactivateTarget(null),
      },
    );

  const toggleKitchen = (outlet: OrgOutlet) =>
    setKitchen.mutate(
      { outletId: outlet.id, skipKitchen: !outlet.skipKitchenWorkflow },
      {
        onSuccess: () =>
          setMessage(outlet.skipKitchenWorkflow ? `${outlet.name}: orders go to the kitchen again` : `${outlet.name}: orders skip the kitchen screen`),
        onError: (e) => setMessage(getErrorMessage(e, "Failed to update kitchen setting. Please try again.")),
      },
    );

  const confirmDelete = () => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, {
      onSuccess: () => setMessage(`${deleteTarget.name} deleted`),
      onError: (e) => setMessage(getErrorMessage(e, "Failed to delete outlet. Please try again.")),
      onSettled: () => setDeleteTarget(null),
    });
  };

  const refresh = async () => {
    setPulling(true);
    await outlets.refetch();
    setPulling(false);
  };

  const header = (
    <View style={{ gap: 20, marginBottom: 12 }}>
      <AdminHero title="Outlets" subtitle="Your branches, their contact details and status" />

      {outlets.isLoading ? null : (
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          <AdminStat basis={statBasis} tone="slate" icon="office-building-outline" label="Total Outlets" value={String(list.length)} />
          <AdminStat basis={statBasis} tone="emerald" icon="check-circle-outline" label="Active" value={String(active)} />
          <AdminStat basis={statBasis} tone="amber" icon="close-circle-outline" label="Inactive" value={String(list.length - active)} />
        </View>
      )}

      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <AdminSearch value={search} onChangeText={setSearch} placeholder="Search by outlet name or phone..." />
        </View>
        <AdminButton label={contentWidth >= 420 ? "Add Outlet" : "Add"} icon="store-plus-outline" variant="primary" onPress={openAdd} />
      </View>
    </View>
  );

  return (
    <View className="flex-1">
      <FlatList
        data={outlets.isLoading ? [] : filtered}
        keyExtractor={(o) => o.id}
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
          <OutletCard
            outlet={item}
            current={item.id === activeOutletId}
            busy={(setActive.isPending && setActive.variables?.outletId === item.id) || (setKitchen.isPending && setKitchen.variables?.outletId === item.id)}
            onToggleActive={() => (item.isActive ? setDeactivateTarget(item) : changeActive(item, true))}
            onToggleKitchen={() => toggleKitchen(item)}
            onEdit={() => openEdit(item)}
            onDelete={() => setDeleteTarget(item)}
          />
        )}
        ListEmptyComponent={
          outlets.isLoading ? (
            <CardListSkeleton cards={3} />
          ) : outlets.error ? (
            <AdminEmpty icon="alert-circle-outline" text={getErrorMessage(outlets.error, "Failed to load outlets.")} error />
          ) : (
            <AdminEmpty icon="storefront-outline" text={list.length === 0 ? 'No outlets yet. Tap "Add Outlet".' : "No outlets match your search."} />
          )
        }
      />

      <AdminDialog
        visible={dialogOpen}
        onDismiss={() => !save.isPending && setDialogOpen(false)}
        icon="storefront-outline"
        title={editing ? "Edit Outlet" : "Add New Outlet"}
        error={formError}
        busy={save.isPending}
        submitLabel={editing ? "Save Changes" : "Add Outlet"}
        onSubmit={submit}
        danger={
          editing
            ? {
                label: "Delete outlet",
                icon: "trash-can-outline",
                onPress: () => {
                  setDialogOpen(false);
                  setDeleteTarget(editing);
                },
              }
            : undefined
        }
      >
        <AdminField label="Outlet Name" icon="storefront-outline" value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} placeholder="e.g. Thamel Branch" maxLength={255} editable={!save.isPending} />
        <AdminField label="Phone Number" icon="phone-outline" value={form.phone} onChangeText={(phone) => setForm((f) => ({ ...f, phone }))} placeholder="01-XXXXXXX" keyboardType="phone-pad" maxLength={30} editable={!save.isPending} />
        <AdminField label="Address" icon="map-marker-outline" value={form.address} onChangeText={(address) => setForm((f) => ({ ...f, address }))} placeholder="Street, city" editable={!save.isPending} />
        {!editing ? <Text style={{ color: d.muted, fontSize: 12 }}>After adding, switch to the new outlet from the menu to set up its tables, menu and staff.</Text> : null}
      </AdminDialog>

      <ConfirmDialog
        visible={!!deactivateTarget}
        onDismiss={() => !setActive.isPending && setDeactivateTarget(null)}
        icon="store-off-outline"
        title={`Make ${deactivateTarget?.name ?? "outlet"} inactive?`}
        message="Its staff can't log in to it until you make it active again. Orders and data are kept."
        confirmLabel="Make Inactive"
        busy={setActive.isPending}
        onConfirm={() => deactivateTarget && changeActive(deactivateTarget, false)}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        onDismiss={() => !remove.isPending && setDeleteTarget(null)}
        icon="trash-can-outline"
        title={`Delete ${deleteTarget?.name ?? "outlet"}?`}
        message="This cannot be undone. An outlet that still has orders or staff can't be deleted — make it inactive instead."
        confirmLabel="Delete"
        busy={remove.isPending}
        onConfirm={confirmDelete}
      />

      <Snackbar visible={!!message} onDismiss={() => setMessage(null)} duration={3500}>
        {message ?? ""}
      </Snackbar>
    </View>
  );
}

/** One outlet: name, phone, address, status (tap to switch), kitchen setting, Edit / Delete. */
function OutletCard({
  outlet,
  current,
  busy,
  onToggleActive,
  onToggleKitchen,
  onEdit,
  onDelete,
}: {
  outlet: OrgOutlet;
  current: boolean;
  busy: boolean;
  onToggleActive: () => void;
  onToggleKitchen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const d = useDashboardPalette();
  const pill = outlet.isActive ? d.status.completed : { bg: d.skeleton, text: d.sub, dot: d.muted };

  return (
    <View className="gap-3 rounded-xl p-4" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: current ? d.brand.edge : d.border }}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: d.brand.tile }}>
            <MaterialCommunityIcons name="storefront-outline" size={20} color={d.brand.icon} />
          </View>
          <View className="flex-1">
            <Text numberOfLines={1} style={{ color: d.text, fontSize: 15, fontWeight: "700" }}>
              {outlet.name}
            </Text>
            {current ? <Text style={{ color: d.link, fontSize: 11, fontWeight: "700" }}>YOU'RE WORKING HERE</Text> : null}
          </View>
        </View>
        <Pressable
          onPress={onToggleActive}
          disabled={busy || (current && outlet.isActive)}
          accessibilityRole="switch"
          accessibilityState={{ checked: outlet.isActive, disabled: busy || (current && outlet.isActive) }}
          accessibilityLabel={`${outlet.name} is ${outlet.isActive ? "active" : "inactive"}. Tap to change.`}
          hitSlop={6}
          className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1 active:opacity-60"
          style={{ backgroundColor: pill.bg }}
        >
          <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pill.dot }} />
          <Text style={{ color: pill.text, fontSize: 12, fontWeight: "600" }}>{outlet.isActive ? "Active" : "Inactive"}</Text>
          {current && outlet.isActive ? null : <MaterialCommunityIcons name="swap-horizontal" size={12} color={pill.text} />}
        </Pressable>
      </View>

      <View className="gap-1.5 rounded-lg p-3" style={{ backgroundColor: d.rowExpanded, borderWidth: 1, borderColor: d.border }}>
        <View className="flex-row items-center gap-2">
          <MaterialCommunityIcons name="phone-outline" size={14} color={d.muted} />
          <Text style={{ color: d.sub, fontSize: 12, fontFamily: "monospace" }}>{outlet.phone || "—"}</Text>
        </View>
        <View className="flex-row items-start gap-2">
          <MaterialCommunityIcons name="map-marker-outline" size={14} color={d.muted} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, color: d.sub, fontSize: 12 }}>{outlet.address || "—"}</Text>
        </View>
      </View>

      <View className="flex-row items-center gap-3">
        <MaterialCommunityIcons name="chef-hat" size={18} color={d.brand.icon} />
        <View className="flex-1">
          <Text style={{ color: d.title, fontSize: 13, fontWeight: "600" }}>Send orders to the kitchen</Text>
          <Text style={{ color: d.muted, fontSize: 11 }}>
            {outlet.skipKitchenWorkflow ? "Off — orders skip the kitchen screen" : "On — the kitchen prepares each order (KOT)"}
          </Text>
        </View>
        <Switch
          value={!outlet.skipKitchenWorkflow}
          disabled={busy}
          onValueChange={onToggleKitchen}
          trackColor={{ true: d.brand.edge, false: d.border }}
          thumbColor="#ffffff"
          accessibilityLabel="Send orders to the kitchen"
        />
      </View>

      <View className="flex-row justify-end gap-2">
        <AdminButton label="Edit" icon="pencil-outline" onPress={onEdit} />
        <AdminButton label="Delete" icon="trash-can-outline" onPress={onDelete} disabled={current} />
      </View>
    </View>
  );
}
