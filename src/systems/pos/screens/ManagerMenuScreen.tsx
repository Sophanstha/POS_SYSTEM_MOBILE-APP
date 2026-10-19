import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMemo, useState, type ComponentProps } from "react";
import { FlatList, Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Snackbar } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../../shared/api/client";
import {
  AdminDialog,
  AdminEmpty,
  AdminField,
  AdminHero,
  AdminSearch,
  ConfirmDialog,
  useAdminContentWidth,
  PageFooter,
} from "../../../shared/components/AdminUI";
import { usePagedList } from "../../../shared/hooks/usePagedList";
import MenuItemDialog from "../components/admin/MenuItemDialog";
import { rs } from "../components/admin/SalesTrendCard";
import { CardListSkeleton } from "../../../shared/components/Skeleton";
import { usePosAuth } from "../auth/PosAuthProvider";
import { useDeleteCategory, useDeleteMenuItem, useMenuItems, useSaveCategory } from "../hooks/useAdmin";
import { useCategories } from "../hooks/useMenu";
import { useDashboardPalette } from "../../../shared/theme/dashboardPalette";
import type { MenuItem } from "../types/admin";
import type { Category } from "../types/pos";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const MAX_WIDTH = 1200;
const SIDE_GUTTER = 16;
const GAP = 12;
/** First cell of the grid: the dashed "Add New Item" card. */
const ADD_CELL = "add" as const;
type Cell = MenuItem | typeof ADD_CELL;

/** In stock when the item and at least one of its sizes are available (like the web). */
const inStock = (item: MenuItem) => item.isAvailable !== false && (item.sizes.length === 0 || item.sizes.some((s) => s.isAvailable));

/**
 * Manager "Menu Editor", like the web: category tabs (add / rename / delete),
 * search, and every item as a card with photo, sizes and prices. Add or edit an item
 * in a dialog, with a photo from the gallery or camera.
 */
export default function ManagerMenuScreen() {
  const d = useDashboardPalette();
  const insets = useSafeAreaInsets();
  const contentWidth = useAdminContentWidth();
  const { hasPermission } = usePosAuth();

  const categoriesQuery = useCategories();
  const menu = useMenuItems();
  const deleteItem = useDeleteMenuItem();
  const saveCategory = useSaveCategory();
  const deleteCategory = useDeleteCategory();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [manageCategories, setManageCategories] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [itemDialog, setItemDialog] = useState<{ open: boolean; item: MenuItem | null }>({ open: false, item: null });
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);

  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; category: Category | null }>({ open: false, category: null });
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [noCategoryOpen, setNoCategoryOpen] = useState(false);

  const canCreateItem = hasPermission("inventory.products.create");
  const canUpdateItem = hasPermission("inventory.products.update");
  const canDeleteItem = hasPermission("inventory.products.delete");
  const canCreateCategory = hasPermission("inventory.categories.create");
  const canUpdateCategory = hasPermission("inventory.categories.update");
  const canDeleteCategory = hasPermission("inventory.categories.delete");
  const canManageCategories = canUpdateCategory || canDeleteCategory;

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const categoryNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  // Items of deleted categories are hidden, like the web.
  const items = useMemo(() => (menu.data ?? []).filter((i) => categoryNames.has(i.categoryId)), [menu.data, categoryNames]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (activeCategory === "all" || i.categoryId === activeCategory) &&
        (!q || i.name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q)),
    );
  }, [items, activeCategory, search]);

  const loading = categoriesQuery.isLoading || menu.isLoading;
  const loadError = categoriesQuery.error ?? menu.error;

  // Grid: 2 cards per row on a phone, up to 4 on a tablet.
  const listWidth = Math.min(contentWidth, MAX_WIDTH) - SIDE_GUTTER * 2;
  const columns = listWidth >= 1000 ? 4 : listWidth >= 680 ? 3 : listWidth >= 300 ? 2 : 1;
  const cardWidth = (listWidth - GAP * (columns - 1)) / columns;

  // 20 cards at first, 20 more as you scroll; a new category or search starts again.
  const page = usePagedList(filtered, `${activeCategory}|${search.trim()}`);

  const cells: Cell[] = loading || loadError ? [] : canCreateItem && !search.trim() ? [ADD_CELL, ...page.visible] : page.visible;

  // ── Items ──

  const openAddItem = () => {
    if (categories.length === 0) {
      setNoCategoryOpen(true);
      return;
    }
    setItemDialog({ open: true, item: null });
  };

  const openEditItem = (item: MenuItem) => setItemDialog({ open: true, item });

  const askDeleteItem = (item: MenuItem) => {
    setItemDialog((s) => ({ ...s, open: false }));
    setItemToDelete(item);
  };

  const confirmDeleteItem = () => {
    if (!itemToDelete) return;
    deleteItem.mutate(itemToDelete.id, {
      onSuccess: () => setMessage(`${itemToDelete.name} deleted`),
      onError: (e) => setMessage(getErrorMessage(e, "Failed to delete product.")),
      onSettled: () => setItemToDelete(null),
    });
  };

  // ── Categories ──

  const openCategory = (category: Category | null) => {
    setCategoryName(category?.name ?? "");
    setCategoryError(null);
    setCategoryDialog({ open: true, category });
  };

  const closeCategory = () => {
    if (saveCategory.isPending) return;
    setCategoryDialog((s) => ({ ...s, open: false }));
  };

  const submitCategory = () => {
    const name = categoryName.trim();
    if (!name) return setCategoryError("Enter a category name.");
    if (name.length > 100) return setCategoryError("Category name can be at most 100 characters.");
    setCategoryError(null);
    const editing = categoryDialog.category;
    saveCategory.mutate(
      { category: editing, name },
      {
        onSuccess: () => {
          setCategoryDialog((s) => ({ ...s, open: false }));
          setMessage(editing ? `Category renamed to ${name}` : `Category ${name} added`);
        },
        onError: (e) => setCategoryError(getErrorMessage(e, "Failed to save category.")),
      },
    );
  };

  const askDeleteCategory = () => {
    const category = categoryDialog.category;
    if (!category) return;
    setCategoryDialog((s) => ({ ...s, open: false }));
    setCategoryToDelete(category);
  };

  const confirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    deleteCategory.mutate(categoryToDelete.id, {
      onSuccess: () => {
        if (activeCategory === categoryToDelete.id) setActiveCategory("all");
        setMessage(`Category ${categoryToDelete.name} deleted`);
      },
      onError: (e) => setMessage(getErrorMessage(e, "Failed to delete category.")),
      onSettled: () => setCategoryToDelete(null),
    });
  };

  const refresh = async () => {
    setPulling(true);
    await Promise.all([categoriesQuery.refetch(), menu.refetch()]);
    setPulling(false);
  };

  const header = (
    <View style={{ gap: 16, marginBottom: GAP }}>
      <AdminHero
        title="Menu Editor"
        subtitle={loading ? undefined : `${items.length} item${items.length === 1 ? "" : "s"} · ${categories.length} categor${categories.length === 1 ? "y" : "ies"}`}
      />

      {/* Category tabs */}
      <View className="gap-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <CategoryChip label="All Items" active={activeCategory === "all"} onPress={() => setActiveCategory("all")} />
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.name}
              active={activeCategory === c.id}
              editIcon={manageCategories}
              onPress={() => (manageCategories ? openCategory(c) : setActiveCategory(c.id))}
            />
          ))}
          {canCreateCategory ? <CategoryChip label="Category" icon="plus" dashed onPress={() => openCategory(null)} /> : null}
          {canManageCategories && categories.length > 0 ? (
            <CategoryChip
              label={manageCategories ? "Done" : "Manage"}
              icon={manageCategories ? "check" : "cog-outline"}
              warning={manageCategories}
              onPress={() => setManageCategories((m) => !m)}
            />
          ) : null}
        </ScrollView>
        {manageCategories ? (
          <Text style={{ color: d.amber.icon, fontSize: 12 }}>Tap a category to rename or delete it.</Text>
        ) : null}
      </View>

      <AdminSearch value={search} onChangeText={setSearch} placeholder="Search menu items..." />
    </View>
  );

  return (
    <View className="flex-1">
      <FlatList
        key={`cols-${columns}`}
        data={cells}
        numColumns={columns}
        keyExtractor={(c) => (c === ADD_CELL ? ADD_CELL : c.id)}
        ListHeaderComponent={header}
        columnWrapperStyle={columns > 1 ? { gap: GAP } : undefined}
        contentContainerStyle={{
          gap: GAP,
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: SIDE_GUTTER,
          width: "100%",
          maxWidth: MAX_WIDTH,
          alignSelf: "center",
        }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} />}
        renderItem={({ item: cell }) =>
          cell === ADD_CELL ? (
            <AddItemCard width={cardWidth} onPress={openAddItem} />
          ) : (
            <MenuCard
              item={cell}
              width={cardWidth}
              category={categoryNames.get(cell.categoryId) ?? ""}
              onEdit={canUpdateItem ? () => openEditItem(cell) : undefined}
              onDelete={canDeleteItem ? () => setItemToDelete(cell) : undefined}
            />
          )
        }
        onEndReached={page.loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          !loading && !loadError && filtered.length === 0 && (items.length > 0 || !canCreateItem) ? (
            <AdminEmpty icon="silverware-fork-knife" text={items.length === 0 ? "No menu items yet." : "No items found."} />
          ) : loading || loadError ? null : (
            <PageFooter shown={page.shown} total={page.total} hasMore={page.hasMore} onMore={page.loadMore} noun="menu items" />
          )
        }
        ListEmptyComponent={
          loading ? (
            <CardListSkeleton cards={4} />
          ) : loadError ? (
            <AdminEmpty icon="alert-circle-outline" text={getErrorMessage(loadError, "Failed to load the menu.")} error />
          ) : null
        }
      />

      <MenuItemDialog
        visible={itemDialog.open}
        item={itemDialog.item}
        categories={categories}
        onDismiss={() => setItemDialog((s) => ({ ...s, open: false }))}
        onSaved={(text) => {
          setItemDialog((s) => ({ ...s, open: false }));
          setMessage(text);
        }}
        onDelete={canDeleteItem ? askDeleteItem : undefined}
      />

      <ConfirmDialog
        visible={!!itemToDelete}
        onDismiss={() => !deleteItem.isPending && setItemToDelete(null)}
        icon="trash-can-outline"
        title="Delete Item?"
        message={`${itemToDelete?.name ?? "This item"} is removed from the menu. This action cannot be undone.`}
        confirmLabel="Delete"
        busy={deleteItem.isPending}
        onConfirm={confirmDeleteItem}
      />

      <AdminDialog
        visible={categoryDialog.open}
        onDismiss={closeCategory}
        icon="shape-outline"
        title={categoryDialog.category ? "Edit Category" : "Add Category"}
        error={categoryError}
        busy={saveCategory.isPending}
        submitLabel={categoryDialog.category ? "Save Changes" : "Add Category"}
        onSubmit={submitCategory}
        danger={
          categoryDialog.category && canDeleteCategory
            ? { label: "Delete category", icon: "trash-can-outline", onPress: askDeleteCategory }
            : undefined
        }
      >
        <AdminField
          label="Category Name"
          value={categoryName}
          onChangeText={setCategoryName}
          placeholder="e.g. Drinks"
          maxLength={100}
          autoFocus
          editable={!saveCategory.isPending && (!categoryDialog.category || canUpdateCategory)}
        />
      </AdminDialog>

      <ConfirmDialog
        visible={!!categoryToDelete}
        onDismiss={() => !deleteCategory.isPending && setCategoryToDelete(null)}
        icon="trash-can-outline"
        title={`Delete ${categoryToDelete?.name ?? "category"}?`}
        message="The category is removed from the menu. Move its items to another category first if you still want to sell them."
        confirmLabel="Delete"
        busy={deleteCategory.isPending}
        onConfirm={confirmDeleteCategory}
      />

      <ConfirmDialog
        visible={noCategoryOpen}
        onDismiss={() => setNoCategoryOpen(false)}
        icon="shape-outline"
        tone="primary"
        title="No categories yet"
        message="Every menu item belongs to a category. Add a category first, then add items to it."
        confirmLabel="Add Category"
        onConfirm={() => {
          setNoCategoryOpen(false);
          if (canCreateCategory) openCategory(null);
        }}
      />

      <Snackbar visible={!!message} onDismiss={() => setMessage(null)} duration={3000}>
        {message ?? ""}
      </Snackbar>
    </View>
  );
}

/** Category tab; in "Manage" mode it shows a pencil and opens the category instead. */
function CategoryChip({
  label,
  active,
  icon,
  editIcon,
  dashed,
  warning,
  onPress,
}: {
  label: string;
  active?: boolean;
  icon?: IconName;
  editIcon?: boolean;
  dashed?: boolean;
  warning?: boolean;
  onPress: () => void;
}) {
  const d = useDashboardPalette();
  const bg = active ? d.chip.activeBg : warning ? d.amber.edge : d.chip.idleBg;
  const color = active || warning ? d.chip.activeText : dashed ? d.link : d.chip.idleText;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className="flex-row items-center gap-1.5 rounded-lg px-3.5 py-2 active:opacity-70"
      style={{
        backgroundColor: bg,
        borderWidth: 1,
        borderStyle: dashed ? "dashed" : "solid",
        borderColor: active ? d.chip.activeBg : warning ? d.amber.edge : dashed ? d.brand.edge : d.chip.border,
      }}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={14} color={color} /> : null}
      <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{label}</Text>
      {editIcon ? <MaterialCommunityIcons name="pencil-outline" size={13} color={color} /> : null}
    </Pressable>
  );
}

/** Dashed "Add New Item" card at the start of the grid (like the web). */
function AddItemCard({ width, onPress }: { width: number; onPress: () => void }) {
  const d = useDashboardPalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add new item"
      className="items-center justify-center gap-2 rounded-xl p-4 active:opacity-70"
      style={{ width, minHeight: 200, borderWidth: 2, borderStyle: "dashed", borderColor: d.border, backgroundColor: d.rowExpanded }}
    >
      <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: d.brand.tile }}>
        <MaterialCommunityIcons name="plus" size={24} color={d.brand.icon} />
      </View>
      <Text style={{ color: d.sub, fontSize: 13, fontWeight: "600", textAlign: "center" }}>Add New Item</Text>
      <Text style={{ color: d.muted, fontSize: 11, textAlign: "center" }}>Tap to add a menu item</Text>
    </Pressable>
  );
}

/** One item: photo, category / sizes badges, name, price or sizes, description, Edit / Delete. */
function MenuCard({
  item,
  width,
  category,
  onEdit,
  onDelete,
}: {
  item: MenuItem;
  width: number;
  category: string;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const d = useDashboardPalette();
  const hasSizes = item.sizes.length > 1;
  const available = inStock(item);
  // Narrow cards (phones): icon-only buttons.
  const compact = width < 190;

  return (
    <View className="overflow-hidden rounded-xl" style={{ width, backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
      <View style={{ width: "100%", aspectRatio: 4 / 3, backgroundColor: d.skeleton }}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} accessibilityLabel={item.name} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
        ) : (
          <View className="flex-1 items-center justify-center">
            <MaterialCommunityIcons name="silverware-fork-knife" size={30} color={d.muted} style={{ opacity: 0.6 }} />
          </View>
        )}
        <View className="absolute left-2 right-2 top-2 flex-row flex-wrap gap-1">
          {category ? <Badge text={category} /> : null}
          {hasSizes ? <Badge icon="ruler" text={`${item.sizes.length} sizes`} /> : null}
        </View>
        {!available ? (
          <View className="absolute bottom-2 left-2 rounded-md px-2 py-0.5" style={{ backgroundColor: d.red.edge }}>
            <Text style={{ color: "#ffffff", fontSize: 10, fontWeight: "700" }}>Out of Stock</Text>
          </View>
        ) : null}
      </View>

      <View className="flex-1 gap-1.5 p-3">
        <Text numberOfLines={2} style={{ color: d.text, fontSize: 14, fontWeight: "600" }}>
          {item.name}
        </Text>

        {hasSizes ? (
          <View className="gap-0.5">
            {item.sizes.map((s) => (
              <Text key={s.id} numberOfLines={1} style={{ color: s.isAvailable ? d.sub : d.muted, fontSize: 12 }}>
                {s.label}
                {s.isAvailable ? "" : " (out)"}: <Text style={{ color: d.revenue, fontWeight: "700" }}>{rs(s.price)}</Text>
              </Text>
            ))}
          </View>
        ) : (
          <Text style={{ color: d.revenue, fontSize: 14, fontWeight: "700" }}>{rs(item.price)}</Text>
        )}

        {item.description ? (
          <Text numberOfLines={2} style={{ color: d.muted, fontSize: 12 }}>
            {item.description}
          </Text>
        ) : null}

        {onEdit || onDelete ? (
          <View className="mt-auto flex-row gap-2 pt-1.5">
            {onEdit ? <CardButton icon="pencil-outline" label={compact ? undefined : "Edit"} onPress={onEdit} /> : null}
            {onDelete ? <CardButton icon="trash-can-outline" label={compact ? undefined : "Delete"} danger onPress={onDelete} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Badge({ text, icon }: { text: string; icon?: IconName }) {
  const d = useDashboardPalette();
  return (
    <View className="flex-row items-center gap-1 rounded-md px-1.5 py-0.5" style={{ backgroundColor: d.card, opacity: 0.92 }}>
      {icon ? <MaterialCommunityIcons name={icon} size={10} color={d.sub} /> : null}
      <Text numberOfLines={1} style={{ color: d.sub, fontSize: 10, fontWeight: "700", maxWidth: 110 }}>
        {text}
      </Text>
    </View>
  );
}

/** Grey Edit / Delete button of a card (label hidden on narrow cards). */
function CardButton({ icon, label, danger, onPress }: { icon: IconName; label?: string; danger?: boolean; onPress: () => void }) {
  const d = useDashboardPalette();
  const color = danger ? d.error.text : d.sub;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? (danger ? "Delete" : "Edit")}
      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2 active:opacity-60"
      style={{ backgroundColor: danger ? d.error.bg : d.skeleton }}
    >
      <MaterialCommunityIcons name={icon} size={15} color={color} />
      {label ? <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{label}</Text> : null}
    </Pressable>
  );
}