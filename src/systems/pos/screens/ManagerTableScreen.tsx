import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { Snackbar } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../../shared/api/client";
import {
  AdminButton,
  AdminDialog,
  AdminEmpty,
  AdminField,
  AdminHero,
  AdminStat,
  ChoiceField,
  ConfirmDialog,
  useAdminContentWidth,
} from "../../../shared/components/AdminUI";
import FloorPlan from "../components/FloorPlan";
import { FloorPlanSkeleton } from "../../../shared/components/Skeleton";
import { usePosAuth } from "../auth/PosAuthProvider";
import { useDeleteTable, useSaveTable } from "../hooks/useAdmin";
import { useMoveTable, useResetLayout, useTables } from "../hooks/useTables";
import { defaultLayout } from "../lib/FloorPlan";
import { TABLE_STATUS_LABEL } from "../lib/pos";
import { useDashboardPalette } from "../../../shared/theme/dashboardPalette";
import { useAppTheme } from "../../../shared/theme/paperTheme";
import { tableStatusColor } from "../theme/statusColors";
import type { TableForm } from "../types/admin";
import type { DiningTable, KotTicket, TableShape, TableStatus } from "../types/pos";

const STATUSES: TableStatus[] = ["available", "occupied", "reserved", "dirty"];
const NO_TICKETS: KotTicket[] = [];
const MAX_WIDTH = 1200;
const SIDE_GUTTER = 16;

/** Form while typing: seats stay text until saved. */
type Draft = Omit<TableForm, "capacity"> & { capacity: string };

const EMPTY_DRAFT: Draft = { tableNumber: "", capacity: "4", shape: "square", status: "available" };

/**
 * Manager "Table Layout", like the web: totals, status legend, the floor plan,
 * add / edit / delete tables, Reset Layout. Tap a table to edit it;
 * "Arrange" lets you drag tables (a touch screen can't tell a drag from a scroll otherwise).
 */
export default function ManagerTablesScreen() {
  const d = useDashboardPalette();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const contentWidth = useAdminContentWidth();
  const { hasPermission } = usePosAuth();

  const tables = useTables();
  const save = useSaveTable();
  const remove = useDeleteTable();
  const moveTable = useMoveTable();
  const resetLayout = useResetLayout();

  const [pulling, setPulling] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DiningTable | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DiningTable | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canCreate = hasPermission("restaurant.tables.create");
  const canUpdate = hasPermission("restaurant.tables.update");
  const canDelete = hasPermission("restaurant.tables.delete");

  const all = tables.data ?? [];
  const available = all.filter((t) => t.status === "available").length;
  const busy = all.filter((t) => t.status === "occupied" || t.status === "dirty").length;

  const pageWidth = Math.min(contentWidth, MAX_WIDTH);
  const statBasis = contentWidth >= 560 ? "30%" : "100%";
  const narrow = contentWidth < 420;

  // A table saved as "rectangle" (allowed by the server) keeps that choice while editing.
  const shapes: { value: TableShape; label: string; icon: "square-rounded-outline" | "circle-outline" | "rectangle-outline" }[] = [
    { value: "square", label: "Square", icon: "square-rounded-outline" },
    { value: "round", label: "Round", icon: "circle-outline" },
    ...(draft.shape === "rectangle" ? [{ value: "rectangle" as const, label: "Rectangle", icon: "rectangle-outline" as const }] : []),
  ];

  const openAdd = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (table: DiningTable) => {
    if (!canUpdate) return;
    setEditing(table);
    setDraft({ tableNumber: table.tableNumber, capacity: String(table.capacity), shape: table.shape, status: table.status });
    setFormError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (save.isPending) return;
    setDialogOpen(false);
  };

  const submit = () => {
    const tableNumber = draft.tableNumber.trim().toUpperCase();
    const capacity = Number(draft.capacity);
    if (!tableNumber) return setFormError("Enter a table name.");
    if (tableNumber.length > 20) return setFormError("Table name can be at most 20 characters.");
    if (!Number.isInteger(capacity) || capacity < 1) return setFormError("Seats must be a whole number, 1 or more.");

    setFormError(null);
    save.mutate(
      { table: editing, form: { tableNumber, capacity, shape: draft.shape, status: draft.status } },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setMessage(editing ? `${tableNumber} saved` : `${tableNumber} added`);
        },
        onError: (e) => setFormError(getErrorMessage(e, "Failed to save table. Please try again.")),
      },
    );
  };

  const askDelete = () => {
    if (!editing) return;
    setDialogOpen(false);
    setDeleteTarget(editing);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, {
      onSuccess: () => setMessage(`${deleteTarget.tableNumber} deleted`),
      onError: (e) => setMessage(getErrorMessage(e, "Failed to delete table. Please try again.")),
      onSettled: () => setDeleteTarget(null),
    });
  };

  const doReset = () => {
    resetLayout.mutate(defaultLayout(all), {
      onSuccess: () => setMessage("Tables put back in a grid"),
      onError: (e) => setMessage(getErrorMessage(e)),
      onSettled: () => setConfirmReset(false),
    });
  };

  const refresh = async () => {
    setPulling(true);
    await tables.refetch();
    setPulling(false);
  };

  return (
    <View className="flex-1">
      <ScrollView
        scrollEnabled={!dragging}
        contentContainerStyle={{
          gap: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: SIDE_GUTTER,
          width: "100%",
          maxWidth: MAX_WIDTH,
          alignSelf: "center",
        }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}
      >
        <AdminHero
          title="Table Layout"
          subtitle={
            arranging
              ? "Drag a table to move it. Each move is saved, also for the web."
              : canUpdate
                ? 'Tap a table to edit it, or "Arrange" to move tables.'
                : undefined
          }
        />

        {tables.isLoading ? null : (
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            <AdminStat basis={statBasis} tone="slate" icon="help-circle-outline" label="Total Tables" value={String(all.length)} />
            <AdminStat basis={statBasis} tone="emerald" icon="check-circle-outline" label="Available" value={String(available)} />
            <AdminStat basis={statBasis} tone="amber" icon="alert-circle-outline" label="Busy / Cleaning" value={String(busy)} />
          </View>
        )}

        {/* Legend + toolbar */}
        <View
          className="flex-row flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
          style={{ backgroundColor: d.rowExpanded, borderWidth: 1, borderColor: d.border }}
        >
          <View className="flex-row flex-wrap items-center" style={{ columnGap: 16, rowGap: 6 }}>
            {STATUSES.map((s) => (
              <View key={s} className="flex-row items-center gap-2">
                <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tableStatusColor(theme, s) }} />
                <Text style={{ color: d.sub, fontSize: 12, fontWeight: "500" }}>{TABLE_STATUS_LABEL[s]}</Text>
              </View>
            ))}
          </View>

          <View className="flex-row flex-wrap items-center gap-2">
            {canUpdate && all.length > 0 ? (
              <>
                <AdminButton
                  label={narrow ? "Reset" : "Reset Layout"}
                  icon="view-grid-outline"
                  disabled={resetLayout.isPending || arranging}
                  onPress={() => setConfirmReset(true)}
                />
                <AdminButton
                  label={arranging ? "Done" : "Arrange"}
                  icon={arranging ? "check" : "arrow-all"}
                  variant={arranging ? "primary" : "outline"}
                  onPress={() => setArranging((a) => !a)}
                />
              </>
            ) : null}
            {canCreate && !arranging ? <AdminButton label="Add Table" icon="plus" variant="primary" onPress={openAdd} /> : null}
          </View>
        </View>

        {tables.isLoading ? (
          <FloorPlanSkeleton />
        ) : tables.error && !tables.data ? (
          <AdminEmpty icon="alert-circle-outline" text={getErrorMessage(tables.error, "Failed to load tables.")} error />
        ) : all.length === 0 ? (
          <View className="rounded-2xl" style={{ borderWidth: 2, borderStyle: "dashed", borderColor: d.border }}>
            <AdminEmpty
              icon="table-chair"
              text={canCreate ? 'No tables yet. Tap "Add Table" to get started.' : "No tables set up for this outlet yet."}
            />
          </View>
        ) : (
          <FloorPlan
            tables={all}
            tickets={NO_TICKETS}
            filter="all"
            arranging={arranging}
            viewportWidth={pageWidth - SIDE_GUTTER * 2}
            onOpenTable={openEdit}
            onMoveTable={(tableId, position) =>
              moveTable.mutate({ tableId, position }, { onError: (e) => setMessage(getErrorMessage(e)) })
            }
            onDragChange={setDragging}
          />
        )}
      </ScrollView>

      <AdminDialog
        visible={dialogOpen}
        onDismiss={closeDialog}
        icon="table-chair"
        title={editing ? `Edit Table ${editing.tableNumber}` : "Add New Table"}
        error={formError}
        busy={save.isPending}
        submitLabel={editing ? "Save Changes" : "Add Table"}
        onSubmit={submit}
        danger={editing && canDelete ? { label: "Delete table", icon: "trash-can-outline", onPress: askDelete } : undefined}
      >
        <View className="flex-row gap-4">
          <View className="flex-1">
            <AdminField
              label="Table Name"
              value={draft.tableNumber}
              onChangeText={(tableNumber) => setDraft((f) => ({ ...f, tableNumber }))}
              placeholder="T1"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
              editable={!save.isPending}
            />
          </View>
          <View style={{ width: 110 }}>
            <AdminField
              label="Seats"
              icon="account-multiple-outline"
              value={draft.capacity}
              onChangeText={(capacity) => setDraft((f) => ({ ...f, capacity: capacity.replace(/[^0-9]/g, "") }))}
              keyboardType="number-pad"
              maxLength={3}
              editable={!save.isPending}
            />
          </View>
        </View>

        <ChoiceField<TableShape>
          label="Shape"
          options={shapes}
          value={draft.shape}
          disabled={save.isPending}
          onChange={(shape) => setDraft((f) => ({ ...f, shape }))}
        />

        <ChoiceField<TableStatus>
          label="Status"
          options={STATUSES.map((s) => ({ value: s, label: TABLE_STATUS_LABEL[s], dot: tableStatusColor(theme, s) }))}
          value={draft.status}
          disabled={save.isPending}
          onChange={(status) => setDraft((f) => ({ ...f, status }))}
        />
      </AdminDialog>

      <ConfirmDialog
        visible={!!deleteTarget}
        onDismiss={() => !remove.isPending && setDeleteTarget(null)}
        icon="trash-can-outline"
        title={`Delete Table ${deleteTarget?.tableNumber ?? ""}?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        busy={remove.isPending}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        visible={confirmReset}
        onDismiss={() => !resetLayout.isPending && setConfirmReset(false)}
        icon="view-grid-outline"
        title="Reset table layout?"
        message="Every table goes back to a neat grid, 6 per row. This also changes the floor plan on the web."
        confirmLabel="Reset Layout"
        tone="primary"
        busy={resetLayout.isPending}
        onConfirm={doReset}
      />

      <Snackbar visible={!!message} onDismiss={() => setMessage(null)} duration={3000}>
        {message ?? ""}
      </Snackbar>
    </View>
  );
}