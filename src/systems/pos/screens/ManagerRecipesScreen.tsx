import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Snackbar } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../../shared/api/client";
import { AdminEmpty, AdminHero, AdminSearch, AdminStat, ConfirmDialog, FilterChips, PageFooter, useAdminContentWidth } from "../../../shared/components/AdminUI";
import { usePagedList } from "../../../shared/hooks/usePagedList";
import RecipeDialog from "../components/admin/RecipeDialog";
import { rs } from "../components/admin/SalesTrendCard";
import { ListSkeleton } from "../../../shared/components/Skeleton";
import { usePosAuth } from "../auth/PosAuthProvider";
import { useDeleteRecipe, useInventory, useRecipeBook } from "../hooks/useAdmin";
import { useDashboardPalette } from "../../../shared/theme/dashboardPalette";
import type { RecipeRow } from "../types/admin";

type Filter = "all" | "configured" | "missing";

const hasRecipe = (row: RecipeRow) => !!row.items && row.items.length > 0;

/**
 * Manager "Recipe Book", like the web: every menu item (each size on its own line),
 * whether it has a recipe, and the ingredients per dish. Tap a line to create or edit its recipe.
 */
export default function ManagerRecipesScreen() {
  const d = useDashboardPalette();
  const insets = useSafeAreaInsets();
  const contentWidth = useAdminContentWidth();
  const { hasPermission } = usePosAuth();

  const book = useRecipeBook();
  const inventory = useInventory();
  const remove = useDeleteRecipe();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pulling, setPulling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; row: RecipeRow | null }>({ open: false, row: null });
  const [deleteTarget, setDeleteTarget] = useState<RecipeRow | null>(null);

  const canEdit = hasPermission("inventory.recipes.create") || hasPermission("inventory.recipes.update");
  const canDelete = hasPermission("inventory.recipes.delete");

  const rows = useMemo(() => book.data ?? [], [book.data]);
  const stockItems = inventory.data ?? [];
  const configured = rows.filter(hasRecipe).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!q || r.name.toLowerCase().includes(q)) &&
        (filter === "all" || (filter === "configured" ? hasRecipe(r) : !hasRecipe(r))),
    );
  }, [rows, search, filter]);

  // 20 menu lines at first, 20 more as you scroll (the counts above still cover every line).
  const page = usePagedList(filtered, `${filter}|${search.trim()}`);

  const statBasis = contentWidth >= 560 ? "30%" : "100%";

  const confirmDelete = () => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget, {
      onSuccess: () => setMessage(`Recipe for ${deleteTarget.name} deleted`),
      onError: (e) => setMessage(getErrorMessage(e, "Failed to delete recipe.")),
      onSettled: () => setDeleteTarget(null),
    });
  };

  const refresh = async () => {
    setPulling(true);
    await Promise.all([book.refetch(), inventory.refetch()]);
    setPulling(false);
  };

  const header = (
    <View style={{ gap: 20, marginBottom: 12 }}>
      <AdminHero title="Recipe Book" subtitle="Ingredients each dish uses — sales take them off the stock" />

      {!inventory.isLoading && stockItems.length === 0 ? (
        <View className="flex-row items-start gap-3 rounded-xl p-4" style={{ backgroundColor: d.banner.bg, borderWidth: 1, borderColor: d.banner.border }}>
          <MaterialCommunityIcons name="alert-outline" size={20} color={d.banner.icon} />
          <View className="flex-1">
            <Text style={{ color: d.banner.title, fontSize: 13, fontWeight: "700" }}>No Stock Items Available</Text>
            <Text style={{ color: d.banner.text, fontSize: 12, marginTop: 2 }}>
              Add ingredients (like sugar, flour, milk) in Inventory before you can map them to menu recipes.
            </Text>
          </View>
        </View>
      ) : null}

      {book.isLoading ? null : (
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          <AdminStat basis={statBasis} tone="slate" icon="silverware-fork-knife" label="Menu Lines" value={String(rows.length)} />
          <AdminStat basis={statBasis} tone="emerald" icon="book-check-outline" label="Configured" value={String(configured)} />
          <AdminStat basis={statBasis} tone="amber" icon="book-alert-outline" label="Needs Recipe" value={String(rows.length - configured)} />
        </View>
      )}

      <View className="gap-3">
        <AdminSearch value={search} onChangeText={setSearch} placeholder="Search products by name..." />
        <FilterChips<Filter>
          options={[
            { value: "all", label: "All Products" },
            { value: "configured", label: "Configured", icon: "check-circle-outline" },
            { value: "missing", label: "Needs Recipe", icon: "alert-circle-outline" },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </View>
    </View>
  );

  return (
    <View className="flex-1">
      <FlatList
        data={book.isLoading ? [] : page.visible}
        keyExtractor={(r) => r.key}
        onEndReached={page.loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          book.isLoading ? null : (
            <PageFooter shown={page.shown} total={page.total} hasMore={page.hasMore} onMore={page.loadMore} noun="menu lines" />
          )
        }
        ListHeaderComponent={header}
        contentContainerStyle={{
          gap: 8,
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
          width: "100%",
          maxWidth: 900,
          alignSelf: "center",
        }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}
        renderItem={({ item }) => (
          <RecipeLine row={item} onPress={canEdit ? () => setDialog({ open: true, row: item }) : undefined} />
        )}
        ListEmptyComponent={
          book.isLoading ? (
            <ListSkeleton rows={6} thumbnail={false} />
          ) : book.error ? (
            <AdminEmpty icon="alert-circle-outline" text={getErrorMessage(book.error, "Failed to load recipes.")} error />
          ) : (
            <AdminEmpty icon="book-open-variant" text={rows.length === 0 ? "No products recorded in menu yet." : "No products match criteria."} />
          )
        }
      />

      <RecipeDialog
        visible={dialog.open}
        row={dialog.row}
        stockItems={stockItems}
        onDismiss={() => setDialog((s) => ({ ...s, open: false }))}
        onSaved={(text) => {
          setDialog((s) => ({ ...s, open: false }));
          setMessage(text);
        }}
        onDelete={
          canDelete
            ? (row) => {
                setDialog((s) => ({ ...s, open: false }));
                setDeleteTarget(row);
              }
            : undefined
        }
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        onDismiss={() => !remove.isPending && setDeleteTarget(null)}
        icon="trash-can-outline"
        title="Wipe Product Recipe?"
        message={`${deleteTarget?.name ?? "This item"} will no longer take ingredients off the stock when sold.`}
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

/** One menu line: name, price, number of ingredients (or "No recipe"). */
function RecipeLine({ row, onPress }: { row: RecipeRow; onPress?: () => void }) {
  const d = useDashboardPalette();
  const count = row.items?.length ?? 0;
  const configured = count > 0;
  const pill = configured ? d.status.completed : d.status.pending;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${configured ? `${count} ingredients` : "no recipe"}`}
      className="gap-2 rounded-xl p-4"
      style={({ pressed }) => ({ backgroundColor: pressed ? d.pressed : d.card, borderWidth: 1, borderColor: d.border })}
    >
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: configured ? d.brand.tile : d.amber.tile }}>
          <MaterialCommunityIcons name={configured ? "book-check-outline" : "book-plus-outline"} size={18} color={configured ? d.brand.icon : d.amber.icon} />
        </View>
        <View className="flex-1">
          <Text numberOfLines={2} style={{ color: d.text, fontSize: 14, fontWeight: "600" }}>
            {row.name}
          </Text>
          <Text style={{ color: d.revenue, fontSize: 12, fontWeight: "700", marginTop: 2 }}>{rs(row.price)}</Text>
        </View>
        <View className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: pill.bg }}>
          <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pill.dot }} />
          <Text style={{ color: pill.text, fontSize: 11, fontWeight: "700" }}>
            {configured ? `${count} ingredient${count === 1 ? "" : "s"}` : "No recipe"}
          </Text>
        </View>
        {onPress ? <MaterialCommunityIcons name="chevron-right" size={18} color={d.muted} /> : null}
      </View>

      {configured ? (
        <Text numberOfLines={2} style={{ color: d.muted, fontSize: 12, paddingLeft: 48 }}>
          {row.items!.map((i) => i.stockItemName).join(" · ")}
        </Text>
      ) : null}
    </Pressable>
  );
}