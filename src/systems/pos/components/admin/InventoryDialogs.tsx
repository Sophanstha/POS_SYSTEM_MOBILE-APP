import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { getErrorMessage } from "../../../../shared/api/client";
import { useChangeStock, useCreateStockCategory, useSaveInventoryItem, useStockCategories } from "../../hooks/useAdmin";
import { qtyText } from "../../lib/units";
import { useDashboardPalette } from "../../../../shared/theme/dashboardPalette";
import type { InventoryItem, StockCategory, StockChange } from "../../types/admin";
import { AdminDialog, AdminField, ChoiceField, FieldLabel, NewCategoryInput } from "../../../../shared/components/AdminUI";

/** Units the server accepts for an ingredient (same list as the web). */
export const STOCK_UNITS = ["kg", "L", "pieces", "g", "ml", "pack", "box", "bottle", "can", "bag", "other"];

const NUMBER_RE = /^\d+(\.\d{1,3})?$/;
const MONEY_RE = /^\d+(\.\d{1,2})?$/;
const UNCATEGORIZED = "";
const NEW_CATEGORY = "__new__";

/** Keeps digits and one dot. */
const decimal = (text: string) => text.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

type ItemDialogProps = {
  visible: boolean;
  /** null = add a new ingredient. */
  item: InventoryItem | null;
  /** Every ingredient, to stop a second one with the same name. */
  existing: InventoryItem[];
  onDismiss: () => void;
  onSaved: (message: string) => void;
  onDelete?: (item: InventoryItem) => void;
};

/** The web's "Register Raw Ingredient" / "Edit Raw Ingredient" dialog. */
export function InventoryItemDialog({ visible, item, existing, onDismiss, onSaved, onDelete }: ItemDialogProps) {
  const save = useSaveInventoryItem();
  const categoriesQuery = useStockCategories();
  const createCategory = useCreateStockCategory();
  const categories = categoriesQuery.data ?? [];

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(UNCATEGORIZED);
  const [unit, setUnit] = useState("kg");
  const [minStock, setMinStock] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(item?.name ?? "");
    setCategoryId(item ? (item.categoryId ?? UNCATEGORIZED) : (categories[0]?.id ?? UNCATEGORIZED));
    setUnit(item?.unit ?? "kg");
    setMinStock(item ? qtyText(item.minStockLevel) : "");
    setAddingCategory(false);
    setError(null);
    // Only when the dialog opens; categories arriving later must not wipe what was typed.
  }, [visible, item]);

  const busy = save.isPending;

  const addCategory = (newName: string) =>
    createCategory.mutate(newName, {
      onSuccess: (category: StockCategory | null) => {
        if (category?.id) setCategoryId(category.id);
        setAddingCategory(false);
      },
      onError: (e) => setError(getErrorMessage(e, "Failed to add category.")),
    });

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return setError("Enter the ingredient name.");
    if (existing.some((m) => m.name.toLowerCase() === trimmed.toLowerCase() && m.id !== item?.id)) {
      return setError(`An ingredient named "${trimmed}" already exists. Use a different name.`);
    }
    if (minStock.trim() && !NUMBER_RE.test(minStock.trim())) return setError("The warning level must be a number (0 or more).");

    setError(null);
    save.mutate(
      { item, form: { name: trimmed, categoryId, unit, minStockLevel: Number(minStock) || 0 } },
      {
        onSuccess: () => onSaved(item ? `${trimmed} saved` : `${trimmed} added — use "Stock" to add the first purchase`),
        onError: (e) => setError(getErrorMessage(e, "Failed to save the ingredient.")),
      },
    );
  };

  return (
    <AdminDialog
      visible={visible}
      onDismiss={() => !busy && onDismiss()}
      icon="scale-balance"
      title={item ? "Edit Raw Ingredient" : "Register Raw Ingredient"}
      error={error}
      busy={busy}
      submitLabel={item ? "Save Changes" : "Add Inventory"}
      onSubmit={submit}
      danger={item && onDelete ? { label: "Delete ingredient", icon: "trash-can-outline", onPress: () => onDelete(item) } : undefined}
    >
      <AdminField label="Ingredient Name" value={name} onChangeText={setName} placeholder="e.g. Flour" maxLength={255} editable={!busy} />

      <View>
        <ChoiceField<string>
          label="Category"
          options={[
            { value: UNCATEGORIZED, label: "Uncategorized" },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
            { value: NEW_CATEGORY, label: "New category", icon: "plus" as const },
          ]}
          value={addingCategory ? NEW_CATEGORY : categoryId}
          disabled={busy}
          onChange={(value) => {
            setAddingCategory(value === NEW_CATEGORY);
            if (value !== NEW_CATEGORY) setCategoryId(value);
          }}
        />
        {addingCategory ? (
          <NewCategoryInput busy={createCategory.isPending} onAdd={addCategory} onCancel={() => setAddingCategory(false)} />
        ) : null}
      </View>

      <ChoiceField<string>
        label={item ? "Unit (can't be changed)" : "Unit"}
        options={(item ? [unit] : STOCK_UNITS).map((u) => ({ value: u, label: u }))}
        value={unit}
        disabled={busy || !!item}
        onChange={setUnit}
      />

      <AdminField
        label={`Low Stock Warning Threshold (${unit})`}
        icon="alert-outline"
        value={minStock}
        onChangeText={(t) => setMinStock(decimal(t))}
        placeholder="e.g. 2"
        keyboardType="decimal-pad"
        editable={!busy}
      />
    </AdminDialog>
  );
}

type StockDialogProps = {
  visible: boolean;
  item: InventoryItem | null;
  onDismiss: () => void;
  onSaved: (message: string) => void;
};

/** The web's "Stock Level" dialog: Restock (Purchase) or Manual Adjustment (recount). */
export function StockLevelDialog({ visible, item, onDismiss, onSaved }: StockDialogProps) {
  const d = useDashboardPalette();
  const change = useChangeStock();

  const [kind, setKind] = useState<StockChange["kind"]>("purchase");
  const [quantity, setQuantity] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [note, setNote] = useState("");
  const [cost, setCost] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !item) return;
    setKind("purchase");
    setQuantity("");
    setNewQuantity(qtyText(item.currentStock));
    setNote("");
    setCost("");
    setExpenseNote("");
    setError(null);
  }, [visible, item]);

  if (!item) return null;
  const busy = change.isPending;
  const purchase = kind === "purchase";

  const submit = () => {
    let stockChange: StockChange;
    if (purchase) {
      if (!NUMBER_RE.test(quantity.trim()) || Number(quantity) <= 0) return setError("Enter how much you bought (more than 0).");
      if (cost.trim() && !MONEY_RE.test(cost.trim())) return setError("The expense amount must be a number.");
      stockChange = {
        kind: "purchase",
        quantity: Number(quantity),
        note: note.trim(),
        totalCost: cost.trim() ? Number(cost) : undefined,
        expenseNote: expenseNote.trim(),
      };
    } else {
      if (!NUMBER_RE.test(newQuantity.trim())) return setError("Enter the counted amount (0 or more).");
      stockChange = { kind: "adjustment", newQuantity: Number(newQuantity), note: note.trim() };
    }

    setError(null);
    change.mutate(
      { itemId: item.id, change: stockChange },
      {
        onSuccess: () =>
          onSaved(
            stockChange.kind === "purchase"
              ? `Added ${qtyText(stockChange.quantity)} ${item.unit} of ${item.name}`
              : `${item.name} set to ${qtyText(stockChange.newQuantity)} ${item.unit}`,
          ),
        onError: (e) => setError(getErrorMessage(e, "Failed to update the stock.")),
      },
    );
  };

  return (
    <AdminDialog
      visible={visible}
      onDismiss={() => !busy && onDismiss()}
      icon="tune-variant"
      title={`Stock Level · ${item.name}`}
      error={error}
      busy={busy}
      submitLabel={purchase ? "Add Stock" : "Save Count"}
      onSubmit={submit}
    >
      <View className="flex-row items-center justify-between rounded-lg px-3.5 py-3" style={{ backgroundColor: d.rowExpanded, borderWidth: 1, borderColor: d.border }}>
        <Text style={{ color: d.sub, fontSize: 13 }}>In stock now</Text>
        <Text style={{ color: d.text, fontSize: 15, fontWeight: "700" }}>
          {qtyText(item.currentStock)} {item.unit}
        </Text>
      </View>

      <ChoiceField<StockChange["kind"]>
        label="Type"
        options={[
          { value: "purchase", label: "Restock (Purchase)", icon: "cart-arrow-down" },
          { value: "adjustment", label: "Manual Adjustment", icon: "counter" },
        ]}
        value={kind}
        disabled={busy}
        onChange={(k) => {
          setKind(k);
          setError(null);
        }}
      />

      {purchase ? (
        <AdminField
          label={`Purchase Quantity (${item.unit})`}
          icon="plus"
          value={quantity}
          onChangeText={(t) => setQuantity(decimal(t))}
          placeholder="e.g. 5"
          keyboardType="decimal-pad"
          editable={!busy}
        />
      ) : (
        <AdminField
          label={`New Stock Count (${item.unit})`}
          icon="counter"
          value={newQuantity}
          onChangeText={(t) => setNewQuantity(decimal(t))}
          placeholder="e.g. 17.5"
          keyboardType="decimal-pad"
          editable={!busy}
        />
      )}

      <AdminField
        label={purchase ? "Purchase Note / Invoice Reference" : "Adjustment Reason / Note"}
        value={note}
        onChangeText={setNote}
        placeholder={purchase ? "e.g. Invoice #1234" : "e.g. Monthly recount"}
        editable={!busy}
      />

      {purchase ? (
        <View className="gap-3 rounded-lg p-3.5" style={{ backgroundColor: d.amber.tile, borderWidth: 1, borderColor: d.amber.edge }}>
          <FieldLabel>Log as Expense (optional)</FieldLabel>
          <AdminField
            label="Expense Amount (Rs.)"
            icon="cash"
            value={cost}
            onChangeText={(t) => setCost(decimal(t))}
            placeholder="0.00"
            keyboardType="decimal-pad"
            editable={!busy}
          />
          <AdminField
            label="Expense Note"
            value={expenseNote}
            onChangeText={setExpenseNote}
            placeholder="Vendor, invoice number..."
            multiline
            textAlignVertical="top"
            editable={!busy}
          />
          <Text style={{ color: d.sub, fontSize: 11 }}>Every purchase is listed in Expenses; the amount is its cost there.</Text>
        </View>
      ) : null}
    </AdminDialog>
  );
}