import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { getErrorMessage } from "../../../../shared/api/client";
import { useSaveRecipe } from "../../hooks/useAdmin";
import { compatibleUnits, conversionPreview, inputAmount, qtyText, toStockUnit } from "../../lib/units";
import { useDashboardPalette } from "../../../../shared/theme/dashboardPalette";
import type { InventoryItem, RecipeRow } from "../../types/admin";
import { AdminDialog, FieldLabel, PickerField, useRevealFocusedInput } from "../../../../shared/components/AdminUI";

type IngredientRow = { key: string; stockItemId: string; qty: string; unit: string };

let rowCounter = 0;
const emptyRow = (): IngredientRow => ({ key: `row-${++rowCounter}`, stockItemId: "", qty: "", unit: "" });

type RecipeDialogProps = {
  visible: boolean;
  row: RecipeRow | null;
  stockItems: InventoryItem[];
  onDismiss: () => void;
  onSaved: (message: string) => void;
  onDelete?: (row: RecipeRow) => void;
};

/**
 * The web's recipe worksheet: which ingredients one dish uses and how much.
 * Amounts can be typed in g / ml for ingredients stocked in kg / L; the server gets the stock unit.
 */
export default function RecipeDialog({ visible, row, stockItems, onDismiss, onSaved, onDelete }: RecipeDialogProps) {
  const d = useDashboardPalette();
  const save = useSaveRecipe();
  const [rows, setRows] = useState<IngredientRow[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);

  const stockById = new Map(stockItems.map((s) => [s.id, s]));

  useEffect(() => {
    if (!visible || !row) return;
    setRows(
      row.items && row.items.length > 0
        ? row.items.map((it) => {
            const stockUnit = stockItems.find((s) => s.id === it.stockItemId)?.unit ?? it.unit;
            const shown = inputAmount(stockUnit, it.quantity);
            return { key: it.id, stockItemId: it.stockItemId, qty: shown.qty, unit: shown.unit };
          })
        : [emptyRow()],
    );
    setError(null);
    // Only when the dialog opens.
  }, [visible, row]);

  if (!row) return null;
  const busy = save.isPending;

  const update = (index: number, change: Partial<IngredientRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...change } : r)));
    setError(null);
  };

  const pickIngredient = (index: number, stockItemId: string) => {
    const stockUnit = stockById.get(stockItemId)?.unit ?? "";
    // kg / L ingredients are usually measured in g / ml per dish.
    const unit = compatibleUnits(stockUnit)[0] ?? stockUnit;
    update(index, { stockItemId, unit });
  };

  const submit = () => {
    const filled = rows.filter((r) => r.stockItemId || r.qty.trim());
    if (filled.length === 0) return setError("Recipe must have at least one ingredient.");
    if (filled.some((r) => !r.stockItemId || !(Number(r.qty) > 0))) {
      return setError("Ensure all ingredients are selected and have a valid quantity greater than 0.");
    }
    const ingredients = filled.map((r) => {
      const stockUnit = stockById.get(r.stockItemId)?.unit ?? r.unit;
      return { stockItemId: r.stockItemId, quantity: Number(toStockUnit(Number(r.qty), r.unit || stockUnit, stockUnit).toFixed(4)) };
    });
    if (ingredients.some((i) => i.quantity <= 0)) return setError("An amount is too small to save. Use a bigger unit or amount.");

    setError(null);
    save.mutate(
      { row, ingredients },
      {
        onSuccess: () => onSaved(`Recipe for ${row.name} saved`),
        onError: (e) => setError(getErrorMessage(e, "Failed to save product recipe.")),
      },
    );
  };

  return (
    <AdminDialog
      visible={visible}
      onDismiss={() => !busy && onDismiss()}
      icon="book-open-variant"
      title={row.name}
      error={error}
      busy={busy}
      submitLabel={row.items ? "Save Recipe" : "Create Recipe"}
      onSubmit={submit}
      danger={row.items && onDelete ? { label: "Delete recipe", icon: "trash-can-outline", onPress: () => onDelete(row) } : undefined}
    >
      <Text style={{ color: d.sub, fontSize: 12 }}>Ingredients used for one dish. Each sale takes them off the stock.</Text>

      {rows.map((r, index) => {
        const stock = stockById.get(r.stockItemId);
        const units = stock ? compatibleUnits(stock.unit) : [];
        const preview = stock ? conversionPreview(r.qty, r.unit, stock.unit) : null;
        // Each ingredient once per recipe.
        const taken = new Set(rows.filter((_, i) => i !== index).map((x) => x.stockItemId));

        return (
          <View key={r.key} className="gap-2 rounded-lg p-3" style={{ backgroundColor: d.rowExpanded, borderWidth: 1, borderColor: d.border }}>
            <View className="flex-row items-center justify-between">
              <FieldLabel>{`Ingredient ${index + 1}`}</FieldLabel>
              <Pressable
                onPress={() => setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [emptyRow()]))}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Remove ingredient"
                hitSlop={8}
                className="mb-1.5 active:opacity-60"
              >
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={d.error.text} />
              </Pressable>
            </View>

            <PickerField
              placeholder="Select ingredient..."
              value={r.stockItemId}
              disabled={busy}
              emptyText="No ingredients in Inventory yet."
              options={stockItems
                .filter((s) => !taken.has(s.id))
                .map((s) => ({ value: s.id, label: s.name, hint: `${qtyText(s.currentStock)} ${s.unit}` }))}
              onChange={(id) => pickIngredient(index, id)}
            />

            <View className="flex-row items-center gap-2">
              <QtyInput value={r.qty} editable={!busy} onChangeText={(qty) => update(index, { qty })} />
              {units.length > 1 ? (
                units.map((u) => {
                  const active = (r.unit || units[0]) === u;
                  return (
                    <Pressable
                      key={u}
                      onPress={() => update(index, { unit: u })}
                      disabled={busy}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      className="rounded-lg px-3.5 py-2.5 active:opacity-70"
                      style={{
                        backgroundColor: active ? d.brand.tile : d.input.bg,
                        borderWidth: 1,
                        borderColor: active ? d.brand.edge : d.input.border,
                      }}
                    >
                      <Text style={{ color: active ? d.link : d.sub, fontSize: 13, fontWeight: active ? "700" : "500" }}>{u}</Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={{ color: d.sub, fontSize: 13, fontWeight: "600", minWidth: 40 }}>{stock?.unit ?? ""}</Text>
              )}
            </View>
            {preview ? <Text style={{ color: d.link, fontSize: 11, fontWeight: "600" }}>{preview}</Text> : null}
          </View>
        );
      })}

      <Pressable
        onPress={() => setRows((prev) => [...prev, emptyRow()])}
        disabled={busy}
        accessibilityRole="button"
        className="flex-row items-center gap-1.5 self-start py-1 active:opacity-60"
      >
        <MaterialCommunityIcons name="plus" size={16} color={d.link} />
        <Text style={{ color: d.link, fontSize: 13, fontWeight: "600" }}>Add ingredient</Text>
      </Pressable>
    </AdminDialog>
  );
}

/** Amount per dish. */
function QtyInput({ value, editable, onChangeText }: { value: string; editable: boolean; onChangeText: (text: string) => void }) {
  const d = useDashboardPalette();
  const reveal = useRevealFocusedInput();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={(t) => onChangeText(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
      onFocus={() => {
        setFocused(true);
        reveal();
      }}
      onBlur={() => setFocused(false)}
      editable={editable}
      placeholder="Qty"
      placeholderTextColor={d.input.placeholder}
      keyboardType="decimal-pad"
      style={{
        flex: 1,
        backgroundColor: d.input.bg,
        borderWidth: 1,
        borderColor: focused ? d.hero.bg : d.input.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: d.input.text,
        fontSize: 14,
      }}
    />
  );
}