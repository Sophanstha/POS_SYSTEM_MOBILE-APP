import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ActivityIndicator, Button, HelperText, Text, TextInput } from "react-native-paper";

import { getErrorMessage } from "../../api/client";
import { useReportWastage, useStockItems } from "../../hooks/useKitchen";
import { useAppTheme } from "../../theme/paperTheme";
import BottomSheet from "../payment/BottomSheet";

type WastageSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  /** Called with a confirmation message after a successful report. */
  onReported: (message: string) => void;
};

/** "1.50" → "1.5", "3.00" → "3". */
const qty = (n: number) => String(Number(n.toFixed(3)));

/**
 * Web: "Report Inventory Wastage" (ingredient). Pick a stock item, enter how much was
 * thrown away, optional note. The server takes it off the stock.
 */
export default function WastageSheet({ visible, onDismiss, onReported }: WastageSheetProps) {
  const theme = useAppTheme();
  const stock = useStockItems(visible);
  const report = useReportWastage();

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantityText, setQuantityText] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fresh form every time it opens.
  useEffect(() => {
    if (!visible) return;
    setSearch("");
    setSelectedId(null);
    setQuantityText("");
    setNote("");
    setError(null);
  }, [visible]);

  const items = stock.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q) || (i.categoryName ?? "").toLowerCase().includes(q)) : items;
  }, [items, search]);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  const submit = () => {
    setError(null);
    const quantity = parseFloat(quantityText.replace(",", "."));
    if (!selected) return setError("Pick the item that was wasted.");
    if (!Number.isFinite(quantity) || quantity <= 0) return setError("Enter how much was wasted.");
    if (quantity > selected.currentStock) {
      return setError(`Can't be more than the stock (${qty(selected.currentStock)} ${selected.unit}).`);
    }

    report.mutate(
      { stockItemId: selected.id, quantity, note: note.trim() || "Kitchen wastage" },
      {
        onSuccess: () => {
          onReported(`Wastage reported: ${qty(quantity)} ${selected.unit} ${selected.name}`);
          onDismiss();
        },
        onError: (e) => setError(getErrorMessage(e)),
      },
    );
  };

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      dismissable={!report.isPending}
      title="Report wastage"
      subtitle="Spoiled, spilled or thrown away — it's taken off the stock."
    >
      <ScrollView style={{ flexShrink: 1 }} contentContainerClassName="gap-3 px-4 pb-3" keyboardShouldPersistTaps="handled">
        <TextInput
          mode="outlined"
          dense
          placeholder="Search inventory item"
          value={search}
          onChangeText={setSearch}
          left={<TextInput.Icon icon="magnify" />}
          disabled={report.isPending}
        />

        <View
          className="overflow-hidden rounded-xl"
          style={{ maxHeight: 240, borderWidth: 1, borderColor: theme.colors.outlineVariant }}
        >
          {stock.isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator />
            </View>
          ) : stock.error ? (
            <Text variant="bodySmall" style={{ color: theme.colors.error, padding: 16, textAlign: "center" }}>
              {getErrorMessage(stock.error)}
            </Text>
          ) : filtered.length === 0 ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, padding: 16, textAlign: "center" }}>
              {items.length === 0 ? "No inventory items for this outlet." : "No item matches your search."}
            </Text>
          ) : (
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {filtered.map((item) => {
                const active = item.id === selectedId;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedId(item.id)}
                    disabled={report.isPending || item.currentStock <= 0}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active, disabled: item.currentStock <= 0 }}
                    className="flex-row items-center gap-3 px-3 py-2.5 active:opacity-70"
                    style={{
                      backgroundColor: active ? theme.colors.primaryContainer : "transparent",
                      borderBottomWidth: 1,
                      borderColor: theme.colors.outlineVariant,
                      opacity: item.currentStock <= 0 ? 0.45 : 1,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={active ? "radiobox-marked" : "radiobox-blank"}
                      size={20}
                      color={active ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    />
                    <View className="flex-1">
                      <Text variant="bodyMedium" numberOfLines={1} style={{ color: theme.colors.onSurface, fontWeight: "600" }}>
                        {item.name}
                      </Text>
                      {item.categoryName ? (
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          {item.categoryName}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      variant="labelLarge"
                      style={{ color: item.isOutOfStock || item.isLowStock ? theme.colors.warning : theme.colors.onSurfaceVariant }}
                    >
                      {qty(item.currentStock)} {item.unit}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        <TextInput
          mode="outlined"
          dense
          label={selected ? `Quantity wasted (${selected.unit})` : "Quantity wasted"}
          placeholder={selected ? `Up to ${qty(selected.currentStock)}` : "Pick an item first"}
          keyboardType="decimal-pad"
          value={quantityText}
          onChangeText={setQuantityText}
          disabled={!selected || report.isPending}
          right={selected ? <TextInput.Affix text={selected.unit} /> : undefined}
        />

        <TextInput
          mode="outlined"
          dense
          label="Note (optional)"
          placeholder="Expired, spilled, overcooked…"
          value={note}
          onChangeText={setNote}
          disabled={report.isPending}
        />

        {error ? (
          <HelperText type="error" padding="none">
            {error}
          </HelperText>
        ) : null}
      </ScrollView>

      <View className="px-4">
        <Button
          mode="contained"
          icon="delete-outline"
          buttonColor={theme.colors.error}
          textColor={theme.colors.onError}
          onPress={submit}
          loading={report.isPending}
          disabled={report.isPending || !selected}
          contentStyle={{ height: 52 }}
        >
          Submit wastage
        </Button>
      </View>
    </BottomSheet>
  );
}