import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Snackbar } from "react-native-paper";
import { DatePickerModal } from "react-native-paper-dates";
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
  ConfirmDialog,
  DateField,
  formatDay,
  NewCategoryInput,
  PickerField,
  useAdminContentWidth,
} from "../components/admin/AdminUI";
import { rs } from "../components/admin/SalesTrendCard";
import { CardListSkeleton } from "../components/Skeleton";
import { useCreateExpenseCategory, useDeleteExpense, useExpenseCategories, useExpenses, useSaveExpense } from "../hooks/useAdmin";
import { toDateParam } from "../lib/pos";
import { useDashboardPalette } from "../theme/dashboardPalette";
import type { Expense, ExpenseCategory } from "../types/admin";

/** "Inventory (Restocks)" filter: stock purchases only. */
const INVENTORY = "inventory";

const AMOUNT_RE = /^\d{1,10}(\.\d{1,2})?$/;

type Draft = { description: string; categoryId: string; amount: string; expenseDate: string; note: string };

const today = () => toDateParam(new Date());

/** Expense date as a day: the server sends midnight of that day. */
const dayOf = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : toDateParam(new Date(iso)));

/**
 * Manager "Expenses", like the web: totals, search, category and date filters,
 * bills typed in by hand (add / edit / delete) and stock purchases from Inventory (read-only).
 */
export default function ManagerExpensesScreen() {
  const d = useDashboardPalette();
  const insets = useSafeAreaInsets();
  const contentWidth = useAdminContentWidth();

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [rangeOpen, setRangeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pulling, setPulling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [draft, setDraft] = useState<Draft>({ description: "", categoryId: "", amount: "", expenseDate: today(), note: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const list = useExpenses({ categoryId: categoryFilter === "all" ? undefined : categoryFilter, ...range });
  const categoriesQuery = useExpenseCategories();
  const save = useSaveExpense();
  const remove = useDeleteExpense();
  const createCategory = useCreateExpenseCategory();

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const expenses = useMemo(() => list.data?.expenses ?? [], [list.data]);
  const stats = list.data?.stats;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter(
      (e) => e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || (e.note ?? "").toLowerCase().includes(q),
    );
  }, [expenses, search]);

  const statBasis = contentWidth >= 560 ? "30%" : "100%";
  const hasDates = !!(range.startDate || range.endDate);
  const moreOnServer = !!stats && stats.totalExpenses > expenses.length;

  // ── Dialog ──

  const openAdd = () => {
    setEditing(null);
    setDraft({ description: "", categoryId: categories[0]?.id ?? "", amount: "", expenseDate: today(), note: "" });
    setFormError(null);
    setAddingCategory(false);
    setDialogOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setDraft({
      description: expense.description,
      categoryId: expense.categoryId ?? categories.find((c) => c.name.toLowerCase() === expense.category.toLowerCase())?.id ?? "",
      amount: String(expense.amount),
      expenseDate: dayOf(expense.date),
      note: expense.note ?? "",
    });
    setFormError(null);
    setAddingCategory(false);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (save.isPending) return;
    setDialogOpen(false);
  };

  const addCategory = (name: string) =>
    createCategory.mutate(name, {
      onSuccess: (category: ExpenseCategory | null) => {
        if (category?.id) setDraft((p) => ({ ...p, categoryId: category.id }));
        setAddingCategory(false);
      },
      onError: (e) => setFormError(getErrorMessage(e, "Failed to add category.")),
    });

  const submit = () => {
    const description = draft.description.trim();
    if (!description || !draft.amount.trim() || !draft.expenseDate) return setFormError("Please fill in description, amount, and date.");
    if (!draft.categoryId) return setFormError("Please select an expense category.");
    if (!AMOUNT_RE.test(draft.amount.trim()) || Number(draft.amount) <= 0) return setFormError("Enter a valid amount greater than 0.");

    setFormError(null);
    save.mutate(
      {
        expense: editing,
        form: { description, categoryId: draft.categoryId, amount: Number(draft.amount), expenseDate: draft.expenseDate, note: draft.note.trim() },
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setMessage(editing ? "Expense saved" : "Expense added");
        },
        onError: (e) => setFormError(getErrorMessage(e, "Failed to save expense.")),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, {
      onSuccess: () => setMessage("Expense deleted"),
      onError: (e) => setMessage(getErrorMessage(e, "Failed to delete expense.")),
      onSettled: () => setDeleteTarget(null),
    });
  };

  const refresh = async () => {
    setPulling(true);
    await Promise.all([list.refetch(), categoriesQuery.refetch()]);
    setPulling(false);
  };

  const header = (
    <View style={{ gap: 20, marginBottom: 12 }}>
      <AdminHero
        title="Expenses"
        subtitle={
          hasDates
            ? `${formatDay(range.startDate ?? range.endDate!)}${range.endDate && range.endDate !== range.startDate ? ` – ${formatDay(range.endDate)}` : ""}`
            : "Bills you add here, plus stock purchases from Inventory"
        }
      />

      {list.isLoading || !stats ? null : (
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          <AdminStat basis={statBasis} tone="slate" icon="receipt" label="Total Expenses" value={String(stats.totalExpenses)} />
          <AdminStat basis={statBasis} tone="red" icon="trending-down" label="Total Spend" value={rs(stats.totalSpend)} />
          <AdminStat
            basis={statBasis}
            tone="amber"
            icon="package-variant"
            label={`From Inventory · ${stats.manualCount} manual`}
            value={String(stats.fromInventory)}
          />
        </View>
      )}

      <View className="gap-3">
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <AdminSearch value={search} onChangeText={setSearch} placeholder="Search expenses..." />
          </View>
          <Pressable
            onPress={() => setRangeOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Filter by date"
            className="flex-row items-center gap-1.5 rounded-lg px-3 py-2.5 active:opacity-70"
            style={{
              backgroundColor: hasDates ? d.chip.activeBg : d.input.bg,
              borderWidth: 1,
              borderColor: hasDates ? d.chip.activeBg : d.input.border,
            }}
          >
            <MaterialCommunityIcons name="calendar-range" size={16} color={hasDates ? d.chip.activeText : d.input.placeholder} />
            <Text style={{ color: hasDates ? d.chip.activeText : d.input.text, fontSize: 13 }}>Dates</Text>
          </Pressable>
          {hasDates ? (
            <Pressable onPress={() => setRange({})} accessibilityRole="button" accessibilityLabel="Clear dates" hitSlop={8} className="p-1 active:opacity-60">
              <MaterialCommunityIcons name="close-circle" size={20} color={d.muted} />
            </Pressable>
          ) : null}
        </View>

        <View className="flex-row items-start gap-2">
          <View className="flex-1">
            <PickerField
              icon="tag-outline"
              placeholder="All Categories"
              value={categoryFilter}
              searchable
              searchPlaceholder="Search categories..."
              options={[
                { value: "all", label: "All Categories" },
                { value: INVENTORY, label: "Inventory (Restocks)", icon: "package-variant" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
              onChange={setCategoryFilter}
            />
          </View>
          <AdminButton label="Add Expense" icon="plus" variant="primary" onPress={openAdd} />
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1">
      <FlatList
        data={list.isLoading ? [] : filtered}
        keyExtractor={(e) => `${e.source}-${e.id}`}
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
        renderItem={({ item }) => <ExpenseRow expense={item} onEdit={() => openEdit(item)} onDelete={() => setDeleteTarget(item)} />}
        ListEmptyComponent={
          list.isLoading ? (
            <CardListSkeleton cards={4} />
          ) : list.error ? (
            <AdminEmpty icon="alert-circle-outline" text={getErrorMessage(list.error, "Failed to load expenses.")} error />
          ) : (
            <AdminEmpty icon="receipt" text={expenses.length === 0 ? "No expenses recorded." : "No expenses match your search."} />
          )
        }
        ListFooterComponent={
          moreOnServer && filtered.length > 0 ? (
            <Text style={{ color: d.muted, fontSize: 12, textAlign: "center", marginTop: 8 }}>
              Showing the newest {expenses.length} of {stats!.totalExpenses}. Pick dates to see older expenses.
            </Text>
          ) : null
        }
      />

      <DatePickerModal
        locale="en"
        mode="range"
        visible={rangeOpen}
        startDate={range.startDate ? new Date(`${range.startDate}T00:00:00`) : undefined}
        endDate={range.endDate ? new Date(`${range.endDate}T00:00:00`) : undefined}
        validRange={{ endDate: new Date() }}
        onDismiss={() => setRangeOpen(false)}
        onConfirm={({ startDate, endDate }) => {
          setRangeOpen(false);
          if (!startDate) return;
          setRange({ startDate: toDateParam(startDate), endDate: toDateParam(endDate ?? startDate) });
        }}
      />

      <AdminDialog
        visible={dialogOpen}
        onDismiss={closeDialog}
        icon="wallet-outline"
        title={editing ? "Edit Expense" : "Add New Expense"}
        error={formError}
        busy={save.isPending}
        submitLabel={editing ? "Save Changes" : "Add Expense"}
        onSubmit={submit}
        danger={
          editing
            ? {
                label: "Delete expense",
                icon: "trash-can-outline",
                onPress: () => {
                  setDialogOpen(false);
                  setDeleteTarget(editing);
                },
              }
            : undefined
        }
      >
        <AdminField
          label="Description"
          value={draft.description}
          onChangeText={(description) => setDraft((p) => ({ ...p, description }))}
          placeholder="e.g. Electricity bill, equipment repair..."
          editable={!save.isPending}
        />

        <View>
          <PickerField
            label="Category"
            placeholder="Select a category..."
            value={draft.categoryId}
            searchable
            searchPlaceholder="Search categories..."
            emptyText="No categories yet. Add one below."
            disabled={save.isPending}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(categoryId) => setDraft((p) => ({ ...p, categoryId }))}
          />
          {addingCategory ? (
            <NewCategoryInput busy={createCategory.isPending} onAdd={addCategory} onCancel={() => setAddingCategory(false)} />
          ) : (
            <Pressable
              onPress={() => setAddingCategory(true)}
              disabled={save.isPending}
              accessibilityRole="button"
              className="mt-2 flex-row items-center gap-1.5 self-start py-1 active:opacity-60"
            >
              <MaterialCommunityIcons name="plus" size={16} color={d.link} />
              <Text style={{ color: d.link, fontSize: 13, fontWeight: "600" }}>New category</Text>
            </Pressable>
          )}
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <AdminField
              label="Amount (Rs.)"
              icon="cash"
              value={draft.amount}
              onChangeText={(amount) => setDraft((p) => ({ ...p, amount: amount.replace(/[^0-9.]/g, "") }))}
              placeholder="0.00"
              keyboardType="decimal-pad"
              editable={!save.isPending}
            />
          </View>
          <View className="flex-1">
            <DateField
              label="Date"
              value={draft.expenseDate}
              disabled={save.isPending}
              onChange={(expenseDate) => setDraft((p) => ({ ...p, expenseDate }))}
            />
          </View>
        </View>

        <AdminField
          label="Notes (optional)"
          value={draft.note}
          onChangeText={(note) => setDraft((p) => ({ ...p, note }))}
          placeholder="Vendor, bill number..."
          multiline
          textAlignVertical="top"
          editable={!save.isPending}
        />
      </AdminDialog>

      <ConfirmDialog
        visible={!!deleteTarget}
        onDismiss={() => !remove.isPending && setDeleteTarget(null)}
        icon="trash-can-outline"
        title="Delete Expense?"
        message={`${deleteTarget?.description ?? "This expense"} (${rs(deleteTarget?.amount ?? 0)}) is removed. This cannot be undone.`}
        confirmLabel="Delete"
        busy={remove.isPending}
        onConfirm={confirmDelete}
      />

      <Snackbar visible={!!message} onDismiss={() => setMessage(null)} duration={3000}>
        {message ?? ""}
      </Snackbar>
    </View>
  );
}

/** One expense: icon, description, category, date, note, amount; Edit / Delete for bills typed in by hand. */
function ExpenseRow({ expense, onEdit, onDelete }: { expense: Expense; onEdit: () => void; onDelete: () => void }) {
  const d = useDashboardPalette();
  const fromStock = expense.source === "inventory";
  const tone = fromStock ? d.amber : d.slate;
  const editable = expense.editable && !fromStock;

  return (
    <View className="gap-3 rounded-xl p-4" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: tone.tile }}>
          <MaterialCommunityIcons name={fromStock ? "package-variant" : "wallet-outline"} size={18} color={tone.icon} />
        </View>
        <View className="flex-1 gap-1">
          <Text numberOfLines={2} style={{ color: d.text, fontSize: 14, fontWeight: "600" }}>
            {expense.description}
          </Text>
          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
            <View className="flex-row items-center gap-1 rounded-md px-1.5 py-0.5" style={{ backgroundColor: d.skeleton }}>
              <MaterialCommunityIcons name="tag-outline" size={11} color={d.sub} />
              <Text style={{ color: d.sub, fontSize: 11, fontWeight: "600" }}>{expense.category}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <MaterialCommunityIcons name="calendar" size={12} color={d.muted} />
              <Text style={{ color: d.muted, fontSize: 12 }}>
                {new Date(expense.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </Text>
            </View>
          </View>
        </View>
        <Text style={{ color: d.text, fontSize: 15, fontWeight: "700" }}>{rs(expense.amount)}</Text>
      </View>

      {expense.note ? (
        <View className="flex-row items-start gap-2">
          <MaterialCommunityIcons name="text-box-outline" size={14} color={d.muted} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, color: d.sub, fontSize: 12 }}>{expense.note}</Text>
        </View>
      ) : null}

      {editable ? (
        <View className="flex-row justify-end gap-2">
          <AdminButton label="Edit" icon="pencil-outline" onPress={onEdit} />
          <AdminButton label="Delete" icon="trash-can-outline" onPress={onDelete} />
        </View>
      ) : (
        <Text style={{ color: d.amber.icon, fontSize: 11, fontWeight: "600" }}>Logged automatically from a stock purchase in Inventory</Text>
      )}
    </View>
  );
}
