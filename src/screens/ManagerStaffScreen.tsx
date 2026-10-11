import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Snackbar } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../api/client";
import {
  AdminButton,
  AdminDialog,
  AdminEmpty,
  AdminField,
  AdminHero,
  AdminSearch,
  AdminStat,
  ChoiceField,
  ConfirmDialog,
  FilterChips,
  useAdminContentWidth,
} from "../components/admin/AdminUI";
import { CardListSkeleton } from "../components/Skeleton";
import { useAuth } from "../context/AuthContext";
import { useRemoveStaff, useSaveStaff, useSetStaffActive, useStaff } from "../hooks/useAdmin";
import { useDashboardPalette } from "../theme/dashboardPalette";
import type { StaffForm, StaffMember } from "../types/admin";

/** Roles a manager can give (the server refuses "Manager"). */
const ROLE_OPTIONS = ["Cashier", "Waiter", "Kitchen Crew"];

const ROLE_ICON: Record<string, "cash-register" | "room-service-outline" | "chef-hat" | "account-outline"> = {
  Cashier: "cash-register",
  Waiter: "room-service-outline",
  "Kitchen Crew": "chef-hat",
};

const EMPTY_FORM: StaffForm = { name: "", role: ROLE_OPTIONS[0]!, email: "", phone: "", password: "" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "Ram Bahadur Thapa" → "RB" */
const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0]!.toUpperCase())
    .slice(0, 2)
    .join("");

/** Same checks as the server, so mistakes show before sending. */
function validate(form: StaffForm, adding: boolean): string | null {
  if (form.name.trim().length < 2) return "Name must be at least 2 characters.";
  if (!EMAIL_RE.test(form.email.trim())) return "Enter a valid email address.";
  if (adding && form.password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

/**
 * Manager "Staff", like the web: totals, search, role filter, add / edit / remove
 * and tap the status pill to switch someone active or inactive.
 */
export default function ManagerStaffScreen() {
  const d = useDashboardPalette();
  const insets = useSafeAreaInsets();
  const contentWidth = useAdminContentWidth();
  const { hasPermission } = useAuth();

  const staff = useStaff();
  const save = useSaveStaff();
  const setActive = useSetStaffActive();
  const remove = useRemoveStaff();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [pulling, setPulling] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canCreate = hasPermission("core.users.create");
  const canUpdate = hasPermission("core.users.update");
  const canDelete = hasPermission("core.users.delete");

  const members = useMemo(() => staff.data ?? [], [staff.data]);
  const active = members.filter((m) => m.isActive).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== "All" && m.role !== roleFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.phone ?? "").includes(q)
      );
    });
  }, [members, search, roleFilter]);

  const statBasis = contentWidth >= 560 ? "30%" : "100%";
  const wideToolbar = contentWidth >= 760;

  // Someone with an older role (e.g. "All Rounder") keeps it as a choice while editing.
  const roleChoices = editing && !ROLE_OPTIONS.includes(editing.role) ? [...ROLE_OPTIONS, editing.role] : ROLE_OPTIONS;

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (member: StaffMember) => {
    setEditing(member);
    setForm({ name: member.name, role: member.role, email: member.email, phone: member.phone ?? "", password: "" });
    setFormError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (save.isPending) return;
    setDialogOpen(false);
  };

  const submit = () => {
    const trimmed = { ...form, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() };
    const problem = validate(trimmed, !editing);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError(null);
    save.mutate(
      { member: editing, form: trimmed },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setMessage(editing ? "Changes saved" : `${trimmed.name} added to staff`);
        },
        onError: (e) => {
          const text = getErrorMessage(e, editing ? "Failed to update staff member." : "Failed to create staff member.");
          setFormError(
            /already (exists|in use)/i.test(text)
              ? `The email address ${trimmed.email} is already registered under another account.`
              : text,
          );
        },
      },
    );
  };

  const confirmRemove = () => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.userId, {
      onSuccess: () => setMessage(`${deleteTarget.name} removed from staff`),
      onError: (e) => setMessage(getErrorMessage(e, "Failed to remove staff member.")),
      onSettled: () => setDeleteTarget(null),
    });
  };

  const toggleActive = (member: StaffMember) =>
    setActive.mutate(
      { userId: member.userId, isActive: !member.isActive },
      { onError: (e) => setMessage(getErrorMessage(e, "Failed to update status.")) },
    );

  const refresh = async () => {
    setPulling(true);
    await staff.refetch();
    setPulling(false);
  };

  const header = (
    <View style={{ gap: 20, marginBottom: 12 }}>
      <AdminHero title="Staff" subtitle="Cashiers, waiters and kitchen crew of this outlet" />

      {staff.isLoading ? null : (
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          <AdminStat basis={statBasis} tone="slate" icon="account-group-outline" label="Total Staff" value={String(members.length)} />
          <AdminStat basis={statBasis} tone="emerald" icon="check-circle-outline" label="Active" value={String(active)} />
          <AdminStat basis={statBasis} tone="amber" icon="close-circle-outline" label="Inactive" value={String(members.length - active)} />
        </View>
      )}

      <View className={wideToolbar ? "flex-row items-center justify-between gap-4" : "gap-3"}>
        <View className={wideToolbar ? "flex-1 gap-3" : "gap-3"} style={wideToolbar ? { maxWidth: 520 } : undefined}>
          <AdminSearch value={search} onChangeText={setSearch} placeholder="Search name, role, email or phone..." />
          <FilterChips<string>
            options={[
              { value: "All", label: "All Roles" },
              ...ROLE_OPTIONS.map((r) => ({ value: r, label: r, icon: ROLE_ICON[r] })),
            ]}
            value={roleFilter}
            onChange={setRoleFilter}
          />
        </View>
        {canCreate ? <AdminButton label="Add Staff" icon="account-plus-outline" variant="primary" onPress={openAdd} /> : null}
      </View>
    </View>
  );

  return (
    <View className="flex-1">
      <FlatList
        data={staff.isLoading ? [] : filtered}
        keyExtractor={(m) => m.userId}
        ListHeaderComponent={header}
        contentContainerStyle={{
          gap: 10,
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
          width: "100%",
          maxWidth: 1000,
          alignSelf: "center",
        }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}
        renderItem={({ item }) => (
          <StaffRow
            member={item}
            wide={contentWidth >= 640}
            onToggle={canUpdate ? () => toggleActive(item) : undefined}
            onEdit={canUpdate ? () => openEdit(item) : undefined}
            onDelete={canDelete ? () => setDeleteTarget(item) : undefined}
          />
        )}
        ListEmptyComponent={
          staff.isLoading ? (
            <CardListSkeleton cards={4} />
          ) : staff.error ? (
            <AdminEmpty icon="alert-circle-outline" text={getErrorMessage(staff.error, "Failed to load staff.")} error />
          ) : (
            <AdminEmpty
              icon="account-group-outline"
              text={members.length === 0 ? 'No staff yet. Tap "Add Staff" to add someone.' : "No staff members match your search."}
            />
          )
        }
      />

      <AdminDialog
        visible={dialogOpen}
        onDismiss={closeDialog}
        icon={editing ? "account-edit-outline" : "account-plus-outline"}
        title={editing ? "Edit Staff Member" : "Add New Staff Member"}
        error={formError}
        busy={save.isPending}
        submitLabel={editing ? "Save Changes" : "Add Staff"}
        onSubmit={submit}
      >
        <AdminField
          label="Full Name"
          icon="account-outline"
          value={form.name}
          onChangeText={(name) => setForm((f) => ({ ...f, name }))}
          placeholder="Enter full name"
          autoCapitalize="words"
          editable={!save.isPending}
        />
        <ChoiceField<string>
          label="Role"
          options={roleChoices.map((r) => ({ value: r, label: r, icon: ROLE_ICON[r] ?? "account-outline" }))}
          value={form.role}
          disabled={save.isPending}
          onChange={(role) => setForm((f) => ({ ...f, role }))}
        />
        <AdminField
          label="Email"
          icon="email-outline"
          value={form.email}
          onChangeText={(email) => setForm((f) => ({ ...f, email }))}
          placeholder="name@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!save.isPending}
        />
        <AdminField
          label="Phone"
          icon="phone-outline"
          value={form.phone}
          onChangeText={(phone) => setForm((f) => ({ ...f, phone }))}
          placeholder="9XXXXXXXXX"
          keyboardType="phone-pad"
          editable={!save.isPending}
        />
        {editing ? null : (
          <AdminField
            label="Password"
            icon="lock-outline"
            password
            value={form.password}
            onChangeText={(password) => setForm((f) => ({ ...f, password }))}
            placeholder="Minimum 8 characters"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!save.isPending}
          />
        )}
      </AdminDialog>

      <ConfirmDialog
        visible={!!deleteTarget}
        onDismiss={() => !remove.isPending && setDeleteTarget(null)}
        icon="alert-outline"
        title="Remove Staff Member?"
        message={
          <>
            Are you sure you want to remove <Text style={{ color: d.text, fontWeight: "600" }}>{deleteTarget?.name}</Text> from
            staff?
          </>
        }
        confirmLabel="Remove"
        busy={remove.isPending}
        onConfirm={confirmRemove}
      />

      <Snackbar visible={!!message} onDismiss={() => setMessage(null)} duration={3000}>
        {message ?? ""}
      </Snackbar>
    </View>
  );
}

/** One person: initials, name, role, status pill (tap to switch), email, phone, Edit / Delete. */
function StaffRow({
  member,
  wide,
  onToggle,
  onEdit,
  onDelete,
}: {
  member: StaffMember;
  /** Tablet / landscape: contact details and buttons on the same line. */
  wide: boolean;
  onToggle?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const d = useDashboardPalette();
  const pill = member.isActive ? d.status.completed : { bg: d.skeleton, text: d.sub, dot: d.muted };

  const contact = (
    <View className="gap-1.5" style={wide ? { flex: 1 } : undefined}>
      <View className="flex-row items-center gap-2">
        <MaterialCommunityIcons name="email-outline" size={14} color={d.muted} />
        <Text numberOfLines={1} style={{ flex: 1, color: d.title, fontSize: 13, fontWeight: "500" }}>
          {member.email}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <MaterialCommunityIcons name="phone-outline" size={14} color={d.muted} />
        <Text style={{ color: d.sub, fontSize: 12, fontFamily: "monospace" }}>{member.phone || "—"}</Text>
      </View>
    </View>
  );

  const actions =
    onEdit || onDelete ? (
      <View className="flex-row items-center gap-2" style={wide ? undefined : { justifyContent: "flex-end" }}>
        {onEdit ? <AdminButton label="Edit" icon="pencil-outline" onPress={onEdit} /> : null}
        {onDelete ? <AdminButton label="Delete" icon="trash-can-outline" onPress={onDelete} /> : null}
      </View>
    ) : null;

  return (
    <View className="gap-3.5 rounded-xl p-4" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: d.rank.bg, borderWidth: 1, borderColor: d.rank.border }}
          >
            <Text style={{ color: d.rank.text, fontSize: 14, fontWeight: "700" }}>{initials(member.name)}</Text>
          </View>
          <View className="flex-1">
            <Text numberOfLines={1} style={{ color: d.text, fontSize: 14, fontWeight: "600" }}>
              {member.name}
            </Text>
            <Text style={{ color: d.sub, fontSize: 12, fontWeight: "500", marginTop: 2 }}>{member.role}</Text>
          </View>
        </View>

        <Pressable
          onPress={onToggle}
          disabled={!onToggle}
          accessibilityRole="switch"
          accessibilityState={{ checked: member.isActive }}
          accessibilityLabel={`${member.name} is ${member.isActive ? "active" : "inactive"}. Tap to change.`}
          hitSlop={6}
          className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1 active:opacity-60"
          style={{ backgroundColor: pill.bg }}
        >
          <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pill.dot }} />
          <Text style={{ color: pill.text, fontSize: 12, fontWeight: "600" }}>{member.isActive ? "Active" : "Inactive"}</Text>
          {onToggle ? <MaterialCommunityIcons name="swap-horizontal" size={12} color={pill.text} /> : null}
        </Pressable>
      </View>

      {wide ? (
        <View className="flex-row items-center gap-4 pt-3" style={{ borderTopWidth: 1, borderColor: d.border }}>
          {contact}
          {actions}
        </View>
      ) : (
        <>
          <View className="rounded-lg p-3" style={{ backgroundColor: d.rowExpanded, borderWidth: 1, borderColor: d.border }}>
            {contact}
          </View>
          {actions}
        </>
      )}
    </View>
  );
}