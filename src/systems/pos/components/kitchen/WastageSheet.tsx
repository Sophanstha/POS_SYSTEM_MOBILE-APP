import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Modal, Portal } from "react-native-paper";

import { getErrorMessage } from "../../../../shared/api/client";
import KeyboardAwareScrollView from "../../../../shared/components/KeyboardAwareScrollView";
import { usePosAuth } from "../../auth/PosAuthProvider";
import { NoRecipeError, useReportWastage, useStockItems, useWastageMenuItems } from "../../hooks/useKitchen";
import { KDS, useKdsPalette, type KdsPalette } from "../../theme/kdsPalette";

type WastageSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  /** Called with a confirmation message after a successful report. */
  onReported: (message: string) => void;
};

type WastageType = "ingredient" | "menu_item";

/** One row of the item picker. */
type Choice = { id: string; label: string; disabled?: boolean };

/** "1.50" → "1.5", "3.00" → "3". */
const qty = (n: number) => String(Number(n.toFixed(3)));

const ERROR_RED = { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)" };
const SUBMIT_RED = "#dc2626";

/**
 * Same as the web KDS "Report Inventory Wastage" dialog: Raw Ingredient or Menu Item,
 * pick the item, how much was wasted and a note. A menu item takes every ingredient
 * of its recipe × number of dishes off the stock.
 */
export default function WastageSheet({ visible, onDismiss, onReported }: WastageSheetProps) {
  const k = useKdsPalette();
  const m = k.modal;
  const { hasPermission } = usePosAuth();
  const canReadRecipes = hasPermission("inventory.recipes.read");

  const [type, setType] = useState<WastageType>("ingredient");
  const [selectedId, setSelectedId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [quantityText, setQuantityText] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const stock = useStockItems(visible && type === "ingredient");
  const menu = useWastageMenuItems(visible && type === "menu_item" && canReadRecipes);
  const report = useReportWastage();
  const busy = report.isPending;

  // Fresh form every time it opens.
  useEffect(() => {
    if (!visible) return;
    setType("ingredient");
    setSelectedId("");
    setPickerOpen(false);
    setSearch("");
    setQuantityText("");
    setNote("");
    setError(null);
  }, [visible]);

  const switchType = (next: WastageType) => {
    if (next === type) return;
    setType(next);
    setSelectedId("");
    setPickerOpen(false);
    setSearch("");
    setError(null);
  };

  const stockItem = type === "ingredient" ? stock.data?.find((i) => i.id === selectedId) : undefined;
  const menuItem = type === "menu_item" ? menu.data?.find((i) => i.id === selectedId) : undefined;

  // Menu items need the recipe, which the Kitchen Crew role can't read by default.
  const blocked = type === "menu_item" && !canReadRecipes;
  const list = type === "ingredient" ? stock : menu;

  const choices = useMemo<Choice[]>(() => {
    const all: Choice[] =
      type === "ingredient"
        ? (stock.data ?? []).map((i) => ({
            id: i.id,
            label: `${i.name} (${qty(i.currentStock)} ${i.unit})`,
            disabled: i.currentStock <= 0,
          }))
        : (menu.data ?? []).map((i) => ({ id: i.id, label: i.name }));
    const q = search.trim().toLowerCase();
    return q ? all.filter((c) => c.label.toLowerCase().includes(q)) : all;
  }, [type, stock.data, menu.data, search]);

  const selectedLabel =
    stockItem ? `${stockItem.name} (${qty(stockItem.currentStock)} ${stockItem.unit})` : menuItem ? menuItem.name : null;

  const submit = () => {
    if (!selectedId || !quantityText.trim()) return setError("Please select an item and enter a quantity");
    const quantity = Number(quantityText.replace(",", "."));
    if (!Number.isFinite(quantity) || quantity <= 0) return setError("Quantity must be greater than zero");
    if (stockItem && quantity > stockItem.currentStock) {
      return setError(
        `Wastage quantity cannot exceed current stock level (${qty(stockItem.currentStock)} ${stockItem.unit})`,
      );
    }
    setError(null);

    const done = (message: string) => {
      onReported(message);
      onDismiss();
    };
    const fail = (e: unknown) =>
      setError(e instanceof NoRecipeError ? e.message : getErrorMessage(e, "Failed to submit wastage"));

    if (stockItem) {
      report.mutate(
        { kind: "ingredient", stockItemId: stockItem.id, quantity, note: note.trim() || "Kitchen wastage" },
        { onSuccess: () => done(`Wastage reported: ${qty(quantity)} ${stockItem.unit} ${stockItem.name}`), onError: fail },
      );
    } else if (menuItem) {
      report.mutate(
        { kind: "menu_item", item: menuItem, dishes: quantity, note: note.trim() || `Wasted menu item (${qty(quantity)}x)` },
        { onSuccess: () => done(`Wastage reported: ${qty(quantity)} × ${menuItem.name}`), onError: fail },
      );
    }
  };

  const close = () => {
    if (!busy) onDismiss();
  };

  const quantityLabel = stockItem ? `Quantity (${stockItem.unit}) *` : type === "menu_item" ? "Quantity (Dishes) *" : "Quantity *";
  const message = error ?? (blocked
    ? "Menu item wastage needs the inventory.recipes.read permission. Ask your manager to add it to your role, or report the raw ingredients instead."
    : null);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={close}
        dismissable={!busy}
        dismissableBackButton={!busy}
        style={{ paddingHorizontal: 16 }}
        contentContainerStyle={{
          alignSelf: "center",
          width: "100%",
          maxWidth: 448,
          maxHeight: "92%",
          backgroundColor: m.bg,
          borderWidth: 1,
          borderColor: m.border,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flexShrink: 1 }}>
          {/* Header */}
          <View
            className="flex-row items-center justify-between px-5 pb-3.5 pt-4"
            style={{ backgroundColor: m.headerBg, borderBottomWidth: 1, borderColor: m.headerBorder }}
          >
            <View className="flex-row items-center gap-2">
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={KDS.red} />
              <Text style={{ color: m.title, fontSize: 15, fontWeight: "700" }}>Report Inventory Wastage</Text>
            </View>
            <Pressable
              onPress={close}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              className="h-7 w-7 items-center justify-center rounded-lg active:opacity-60"
              style={{ opacity: busy ? 0.55 : 1 }}
            >
              <MaterialCommunityIcons name="close" size={18} color={m.close} />
            </Pressable>
          </View>

          <KeyboardAwareScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
            {message ? (
              <View className="rounded-lg p-3" style={{ backgroundColor: ERROR_RED.bg, borderWidth: 1, borderColor: ERROR_RED.border }}>
                <Text style={{ color: KDS.red, fontSize: 12, fontWeight: "500" }}>{message}</Text>
              </View>
            ) : null}

            {/* Raw Ingredient | Menu Item */}
            <View className="flex-row gap-2">
              <TypeButton m={m} label="Raw Ingredient" active={type === "ingredient"} disabled={busy} onPress={() => switchType("ingredient")} />
              <TypeButton m={m} label="Menu Item" active={type === "menu_item"} disabled={busy} onPress={() => switchType("menu_item")} />
            </View>

            {/* Item picker (the web's <select>) */}
            <View>
              <Label m={m}>Select {type === "ingredient" ? "Inventory Item" : "Menu Item"} *</Label>
              {list.isLoading ? (
                <View className="flex-row items-center gap-2 py-2.5">
                  <ActivityIndicator size="small" color={m.close} />
                  <Text style={{ color: m.close, fontSize: 12 }}>Loading items...</Text>
                </View>
              ) : list.error ? (
                <Text style={{ color: KDS.red, fontSize: 12, paddingVertical: 10 }}>{getErrorMessage(list.error)}</Text>
              ) : (
                <>
                  <Pressable
                    onPress={() => setPickerOpen((o) => !o)}
                    disabled={busy || blocked}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: pickerOpen }}
                    className="flex-row items-center justify-between rounded-xl px-3 py-3"
                    style={{
                      backgroundColor: m.input.bg,
                      borderWidth: 1,
                      borderColor: pickerOpen ? m.input.focus : m.input.border,
                      opacity: blocked ? 0.5 : 1,
                    }}
                  >
                    <Text numberOfLines={1} style={{ flex: 1, color: m.input.text, fontSize: 13 }}>
                      {selectedLabel ?? "-- Choose an item --"}
                    </Text>
                    <MaterialCommunityIcons name={pickerOpen ? "chevron-up" : "chevron-down"} size={18} color={m.input.text} />
                  </Pressable>

                  {pickerOpen ? (
                    <View
                      className="mt-1.5 overflow-hidden rounded-xl"
                      style={{ backgroundColor: m.input.bg, borderWidth: 1, borderColor: m.input.border }}
                    >
                      <View className="flex-row items-center gap-2 px-3" style={{ borderBottomWidth: 1, borderColor: m.rowBorder }}>
                        <MaterialCommunityIcons name="magnify" size={16} color={m.input.placeholder} />
                        <TextInput
                          value={search}
                          onChangeText={setSearch}
                          placeholder="Search..."
                          placeholderTextColor={m.input.placeholder}
                          style={{ flex: 1, color: m.input.text, fontSize: 13, paddingVertical: 9 }}
                        />
                      </View>
                      <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {choices.length === 0 ? (
                          <Text style={{ color: m.input.placeholder, fontSize: 12, padding: 14, textAlign: "center" }}>
                            {search ? "No item matches your search." : "No items found."}
                          </Text>
                        ) : (
                          choices.map((c) => {
                            const active = c.id === selectedId;
                            return (
                              <Pressable
                                key={c.id}
                                disabled={c.disabled}
                                onPress={() => {
                                  setSelectedId(c.id);
                                  setPickerOpen(false);
                                  setSearch("");
                                  setError(null);
                                }}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: active, disabled: c.disabled }}
                                className="flex-row items-center justify-between gap-2 px-3 py-3 active:opacity-60"
                                style={{
                                  backgroundColor: active ? m.rowActive : "transparent",
                                  borderBottomWidth: 1,
                                  borderColor: m.rowBorder,
                                  opacity: c.disabled ? 0.4 : 1,
                                }}
                              >
                                <Text numberOfLines={2} style={{ flex: 1, color: m.input.text, fontSize: 13 }}>
                                  {c.label}
                                </Text>
                                {active ? <MaterialCommunityIcons name="check" size={16} color={m.check} /> : null}
                              </Pressable>
                            );
                          })
                        )}
                      </ScrollView>
                    </View>
                  ) : null}
                </>
              )}
            </View>

            <View>
              <Label m={m}>{quantityLabel}</Label>
              <Field
                m={m}
                value={quantityText}
                onChangeText={setQuantityText}
                keyboardType="decimal-pad"
                editable={!busy && !!selectedId}
                placeholder={stockItem ? `Max current stock is ${qty(stockItem.currentStock)}` : "Enter quantity wasted"}
              />
            </View>

            <View>
              <Label m={m}>Wastage Note</Label>
              <Field
                m={m}
                value={note}
                onChangeText={setNote}
                editable={!busy}
                multiline
                numberOfLines={3}
                placeholder="e.g. Expired, spilled during preparation, overcooked..."
                style={{ minHeight: 80, textAlignVertical: "top" }}
              />
            </View>

            <View className="mt-2 flex-row gap-3">
              <Pressable
                onPress={close}
                disabled={busy}
                accessibilityRole="button"
                className="flex-1 items-center justify-center rounded-xl py-3 active:opacity-70"
                style={{ borderWidth: 1, borderColor: m.cancel.border }}
              >
                <Text style={{ color: m.cancel.text, fontSize: 12, fontWeight: "700" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={busy || blocked || !selectedId}
                accessibilityRole="button"
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-3 active:opacity-80"
                style={{ backgroundColor: SUBMIT_RED, opacity: busy || blocked || !selectedId ? 0.5 : 1 }}
              >
                {busy ? <ActivityIndicator size="small" color="#ffffff" /> : null}
                <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>Submit Wastage</Text>
              </Pressable>
            </View>
          </KeyboardAwareScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

type ModalColors = KdsPalette["modal"];

function Label({ m, children }: { m: ModalColors; children: string | string[] }) {
  return (
    <Text style={{ color: m.label, fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>
      {children}
    </Text>
  );
}

function TypeButton({
  m,
  label,
  active,
  disabled,
  onPress,
}: {
  m: ModalColors;
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      className="flex-1 items-center rounded-lg py-2.5 active:opacity-70"
      style={{
        borderWidth: 1,
        backgroundColor: active ? m.tabActive.bg : "transparent",
        borderColor: active ? m.tabActive.border : m.tabIdle.border,
      }}
    >
      <Text style={{ color: active ? m.tabActive.text : m.tabIdle.text, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

/** Rounded input like the web dialog; the border turns gold (dark) / grey (light) while typing. */
function Field({ m, style, editable = true, ...props }: TextInputProps & { m: ModalColors }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      editable={editable}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholderTextColor={m.input.placeholder}
      style={[
        {
          backgroundColor: m.input.bg,
          borderWidth: 1,
          borderColor: focused ? m.input.focus : m.input.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 11,
          color: m.input.text,
          fontSize: 13,
          opacity: editable ? 1 : 0.6,
        },
        style,
      ]}
    />
  );
}
