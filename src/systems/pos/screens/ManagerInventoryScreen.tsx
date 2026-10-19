import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Snackbar } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../../shared/api/client";
import {
  AdminButton,
  AdminEmpty,
  AdminHero,
  AdminSearch,
  AdminStat,
  ConfirmDialog,
  FilterChips,
  useAdminContentWidth,
  PageFooter,
} from "../../../shared/components/AdminUI";
import { usePagedList } from "../../../shared/hooks/usePagedList";
import { InventoryItemDialog, StockLevelDialog } from "../components/admin/InventoryDialogs";
import { CardListSkeleton } from "../../../shared/components/Skeleton";
import { usePosAuth } from "../auth/PosAuthProvider";
import { useDeleteInventoryItem, useInventory, useStockCategories, useStockMovements } from "../hooks/useAdmin";
import { qtyText } from "../lib/units";
import { useDashboardPalette, type DashboardPalette } from "../../../shared/theme/dashboardPalette";
import type { InventoryItem, StockMovement } from "../types/admin";

type Level = "in_stock" | "low_stock" | "out_of_stock";
const UNCATEGORIZED = "uncategorized";

const levelOf = (m: InventoryItem): Level => (m.isOutOfStock ? "out_of_stock" : m.isLowStock ? "low_stock" : "in_stock");

const LEVEL_LABEL: Record<Level, string> = { in_stock: "In Stock", low_stock: "Low Stock", out_of_stock: "Out of Stock" };

const levelColors = (d: DashboardPalette, level: Level) =>
  level === "in_stock" ? d.status.completed : level === "low_stock" ? d.status.pending : d.status.cancelled;

const MOVEMENT_LABEL: Record<StockMovement["type"], string> = {
  purchase: "Purchase",
  deduction: "Used in order",
  wastage: "Wastage",
  adjustment: "Adjustment",
};

/**
 * Manager "Raw Materials Inventory", like the web: stock totals, search, stock-level and
 * category filters, add / edit / delete ingredients, restock or recount ("Stock"),
 * and tap an ingredient to see its stock history.
 */
export default function ManagerInventoryScreen() {
  const insets = useSafeAreaInsets();
  const contentWidth = useAdminContentWidth();
  const { hasPermission } = usePosAuth();

  const inventory = useInventory();
  const categoriesQuery = useStockCategories();
  const remove = useDeleteInventoryItem();

  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | Level>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [itemDialog, setItemDialog] = useState<{ open: boolean; item: InventoryItem | null }>({ open: false, item: null });
  const [stockItem, setStockItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);

  const canCreate = hasPermission("inventory.stock.create");
  const canUpdate = hasPermission("inventory.stock.update");
  const canDelete = hasPermission("inventory.stock.delete");

  const items = useMemo(() => inventory.data ?? [], [inventory.data]);
  const categories = categoriesQuery.data ?? [];

  const stats = useMemo(
    () => ({
      total: items.length,
      inStock: items.filter((m) => levelOf(m) === "in_stock").length,
      low: items.filter((m) => levelOf(m) === "low_stock").length,
      out: items.filter((m) => levelOf(m) === "out_of_stock").length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (m) =>
        (!q || m.name.toLowerCase().includes(q)) &&
        (levelFilter === "all" || levelOf(m) === levelFilter) &&
        (categoryFilter === "all" || (categoryFilter === UNCATEGORIZED ? !m.categoryId : m.categoryId === categoryFilter)),
    );
  }, [items, search, levelFilter, categoryFilter]);

  // 20 ingredients at first, 20 more as you scroll (the counts above still cover every one).
  const page = usePagedList(filtered, `${levelFilter}|${categoryFilter}|${search.trim()}`);

  // 4 cards: one row on a tablet, 2 × 2 on a phone.
  const statBasis = contentWidth >= 900 ? "22%" : "45%";

  const confirmDelete = () => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, {
      onSuccess: () => setMessage(`${deleteTarget.name} deleted`),
      onError: (e) => setMessage(getErrorMessage(e, "Failed to delete the ingredient.")),
      onSettled: () => setDeleteTarget(null),
    });
  };

  const refresh = async () => {
    setPulling(true);
    await Promise.all([inventory.refetch(), categoriesQuery.refetch()]);
    setPulling(false);
  };

  const header = (
    <View style={{ gap: 20, marginBottom: 12 }}>
      <AdminHero title="Raw Materials Inventory" subtitle="Ingredients used by your recipes, and how much is left" />

      {inventory.isLoading ? null : (
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          <AdminStat basis={statBasis} tone="slate" icon="package-variant-closed" label="Total Ingredients" value={String(stats.total)} />
          <AdminStat basis={statBasis} tone="emerald" icon="package-variant-closed-check" label="Optimal Stock" value={String(stats.inStock)} />
          <AdminStat basis={statBasis} tone="amber" icon="alert-outline" label="Critical Stock" value={String(stats.low)} />
          <AdminStat basis={statBasis} tone="red" icon="package-variant-closed-remove" label="No Stock" value={String(stats.out)} />
        </View>
      )}

      <View className="gap-3">
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <AdminSearch value={search} onChangeText={setSearch} placeholder="Search ingredients" />
          </View>
          {canCreate ? (
            <AdminButton
              label={contentWidth >= 420 ? "Add Ingredient" : "Add"}
              icon="plus"
              variant="primary"
              onPress={() => setItemDialog({ open: true, item: null })}
            />
          ) : null}
        </View>
        <FilterChips<"all" | Level>
          options={[
            { value: "all", label: "All Levels" },
            { value: "in_stock", label: "Stable", icon: "check-circle-outline" },
            { value: "low_stock", label: "Low Alert", icon: "alert-outline" },
            { value: "out_of_stock", label: "Depleted", icon: "close-circle-outline" },
          ]}
          value={levelFilter}
          onChange={setLevelFilter}
        />
        {categories.length > 0 ? (
          <FilterChips<string>
            options={[
              { value: "all", label: "All Categories" },
              { value: UNCATEGORIZED, label: "Uncategorized" },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
        ) : null}
      </View>
    </View>
  );

  return (
    <View className="flex-1">
      <FlatList
        data={inventory.isLoading ? [] : page.visible}
        keyExtractor={(m) => m.id}
        onEndReached={page.loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          inventory.isLoading ? null : (
            <PageFooter shown={page.shown} total={page.total} hasMore={page.hasMore} onMore={page.loadMore} noun="ingredients" />
          )
        }
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
          <InventoryRow
            item={item}
            expanded={expanded === item.id}
            onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
            onStock={canUpdate ? () => setStockItem(item) : undefined}
            onEdit={canUpdate ? () => setItemDialog({ open: true, item }) : undefined}
            onDelete={canDelete ? () => setDeleteTarget(item) : undefined}
          />
        )}
        ListEmptyComponent={
          inventory.isLoading ? (
            <CardListSkeleton cards={4} />
          ) : inventory.error ? (
            <AdminEmpty icon="alert-circle-outline" text={getErrorMessage(inventory.error, "Failed to load inventory.")} error />
          ) : (
            <AdminEmpty
              icon="package-variant"
              text={items.length === 0 ? 'No ingredients yet. Tap "Add Ingredient" to register one.' : "No raw materials match criteria."}
            />
          )
        }
      />

      <InventoryItemDialog
        visible={itemDialog.open}
        item={itemDialog.item}
        existing={items}
        onDismiss={() => setItemDialog((s) => ({ ...s, open: false }))}
        onSaved={(text) => {
          setItemDialog((s) => ({ ...s, open: false }));
          setMessage(text);
        }}
        onDelete={
          canDelete
            ? (item) => {
                setItemDialog((s) => ({ ...s, open: false }));
                setDeleteTarget(item);
              }
            : undefined
        }
      />

      <StockLevelDialog
        visible={!!stockItem}
        item={stockItem}
        onDismiss={() => setStockItem(null)}
        onSaved={(text) => {
          setStockItem(null);
          setMessage(text);
        }}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        onDismiss={() => !remove.isPending && setDeleteTarget(null)}
        icon="trash-can-outline"
        title="Delete Material?"
        message={`${deleteTarget?.name ?? "This ingredient"} is removed from inventory. This action cannot be undone.`}
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

/** One ingredient: name, category, stock, warning level, status; tap to show its stock history. */
function InventoryRow({
  item,
  expanded,
  onToggle,
  onStock,
  onEdit,
  onDelete,
}: {
  item: InventoryItem;
  expanded: boolean;
  onToggle: () => void;
  onStock?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const d = useDashboardPalette();
  const level = levelOf(item);
  const c = levelColors(d, level);

  return (
    <View className="overflow-hidden rounded-xl" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint="Shows the stock history"
        className="gap-3 p-4"
        style={({ pressed }) => ({ backgroundColor: pressed ? d.pressed : "transparent" })}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1.5">
            <Text numberOfLines={2} style={{ color: d.text, fontSize: 14, fontWeight: "600" }}>
              {item.name}
            </Text>
            <View className="flex-row items-center gap-1 self-start rounded-md px-1.5 py-0.5" style={{ backgroundColor: item.categoryName ? d.brand.tile : d.skeleton }}>
              <MaterialCommunityIcons name="tag-outline" size={11} color={item.categoryName ? d.link : d.muted} />
              <Text style={{ color: item.categoryName ? d.link : d.muted, fontSize: 11, fontWeight: "600" }}>
                {item.categoryName ?? "Uncategorized"}
              </Text>
            </View>
          </View>
          <View className="items-end gap-1.5">
            <Text style={{ color: d.text, fontSize: 16, fontWeight: "700" }}>
              {qtyText(item.currentStock)} <Text style={{ color: d.muted, fontSize: 12, fontWeight: "400" }}>{item.unit}</Text>
            </Text>
            <View className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: c.bg }}>
              <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
              <Text style={{ color: c.text, fontSize: 11, fontWeight: "700" }}>{LEVEL_LABEL[level]}</Text>
            </View>
          </View>
        </View>

        <View className="flex-row items-center justify-between gap-2">
          <Text style={{ color: d.muted, fontSize: 12 }}>
            Alert below {qtyText(item.minStockLevel)} {item.unit}
          </Text>
          <View className="flex-row items-center gap-1">
            <MaterialCommunityIcons name="history" size={14} color={d.muted} />
            <Text style={{ color: d.muted, fontSize: 12 }}>History</Text>
            <MaterialCommunityIcons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={d.muted} />
          </View>
        </View>

        {onStock || onEdit || onDelete ? (
          <View className="flex-row flex-wrap justify-end gap-2">
            {onStock ? <AdminButton label="Stock" icon="tune-variant" variant="primary" onPress={onStock} /> : null}
            {onEdit ? <AdminButton label="Edit" icon="pencil-outline" onPress={onEdit} /> : null}
            {onDelete ? <AdminButton label="Delete" icon="trash-can-outline" onPress={onDelete} /> : null}
          </View>
        ) : null}
      </Pressable>

      {expanded ? <MovementHistory item={item} /> : null}
    </View>
  );
}

/** Latest stock changes of one ingredient (purchases, orders, wastage, recounts). */
function MovementHistory({ item }: { item: InventoryItem }) {
  const d = useDashboardPalette();
  const movements = useStockMovements(item.id);

  const tone = (type: StockMovement["type"]) =>
    type === "purchase" ? d.status.completed : type === "wastage" ? d.status.cancelled : type === "adjustment" ? d.status.pending : { bg: d.skeleton, text: d.sub, dot: d.muted };

  return (
    <View className="gap-2 p-4" style={{ backgroundColor: d.rowExpanded, borderTopWidth: 1, borderColor: d.border }}>
      <Text style={{ color: d.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }}>STOCK MOVEMENT HISTORY</Text>
      {movements.isLoading ? (
        <ActivityIndicator size="small" color={d.link} style={{ alignSelf: "flex-start", marginVertical: 8 }} />
      ) : movements.error ? (
        <Text style={{ color: d.error.text, fontSize: 12 }}>{getErrorMessage(movements.error, "Couldn't load the history.")}</Text>
      ) : (movements.data ?? []).length === 0 ? (
        <Text style={{ color: d.muted, fontSize: 12 }}>No stock movements recorded for this item.</Text>
      ) : (
        (movements.data ?? []).map((m) => {
          const t = tone(m.type);
          const sign = m.type === "purchase" ? "+" : m.type === "deduction" || m.type === "wastage" ? "−" : "";
          return (
            <View key={m.id} className="flex-row items-start gap-3 rounded-lg p-3" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
              <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: t.bg }}>
                <Text style={{ color: t.text, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>{MOVEMENT_LABEL[m.type] ?? m.type}</Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text style={{ color: d.text, fontSize: 13, fontWeight: "700" }}>
                  {sign}
                  {qtyText(m.quantity)} <Text style={{ color: d.muted, fontSize: 11, fontWeight: "400" }}>{item.unit}</Text>
                </Text>
                {m.note ? <Text style={{ color: d.sub, fontSize: 12 }}>Note: {m.note}</Text> : null}
              </View>
              <View className="items-end">
                <Text style={{ color: d.muted, fontSize: 11 }}>
                  {new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </Text>
                <Text style={{ color: d.sub, fontSize: 11, fontWeight: "600" }}>by {m.createdByName}</Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}