import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ComponentProps } from "react";
import { FlatList, Pressable, ScrollView, TextInput, View } from "react-native";
import { Button, Chip, Divider, Searchbar, Surface, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../api/client";
import { getVariants } from "../../api/pos";
import type { Cart } from "../../hooks/useCart";
import { useLayout } from "../../hooks/useLayout";
import { useCategories, useProducts } from "../../hooks/useMenu";
import { useOutletId } from "../../hooks/shared";
import { formatRs, toNumber } from "../../lib/pos";
import { queryKeys } from "../../lib/queryKey";
import { Bone, ListSkeleton, Skeleton } from "../Skeleton";
import { useAppTheme } from "../../theme/paperTheme";
import { useWebPalette, type WebPalette } from "../../theme/webPalette";
import type { Product, ProductVariant } from "../../types/pos";
import ActiveOrderPanel from "./ActiveOrderPanel";
import CartSheet, { type CustomerDetails } from "./CartSheet";
import ProductCard from "./ProductCard";
import ProductRow from "./ProductRow";
import SizePickerDialog from "./SizePickerDialog";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type OrderBuilderProps = {
  cart: Cart;
  submitLabel: string;
  submitIcon: IconName;
  submitting: boolean;
  /** Return true when the order went through (closes the sheet and clears the customer). */
  onSubmit: (customer: { customerName?: string; customerPhone?: string }) => Promise<boolean>;
  onMessage: (message: string) => void;
};

const EMPTY_CUSTOMER: CustomerDetails = { customerName: "", customerPhone: "" };

const GRID_GAP = 12;
const GRID_PADDING = 16;

/** Width of the "Active Order" sidebar (web: 320px, 350px on big screens). */
function sidebarWidth(screenWidth: number): number {
  if (screenWidth >= 1280) return 350;
  if (screenWidth >= 900) return 320;
  return 290;
}

/** Cards per row, from the width the menu has (web: 2 / 3 / 4). */
function gridColumns(menuWidth: number): number {
  if (menuWidth >= 900) return 4;
  if (menuWidth >= 560) return 3;
  return 2;
}

/**
 * Menu (categories, search, products) + the order being built.
 * Phone: product list, the cart opens in a sheet.
 * Landscape / tablet: like the web — product cards in a grid, "Active Order" sidebar on the right.
 */
export default function OrderBuilder({ cart, submitLabel, submitIcon, submitting, onSubmit, onMessage }: OrderBuilderProps) {
  const theme = useAppTheme();
  const web = useWebPalette();
  const insets = useSafeAreaInsets();
  const { isWide, width } = useLayout();
  const queryClient = useQueryClient();
  const outletId = useOutletId();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [sizeChoice, setSizeChoice] = useState<{ product: Product; variants: ProductVariant[] } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerDetails>(EMPTY_CUSTOMER);
  const [menuWidth, setMenuWidth] = useState(0);

  const categories = useCategories();
  const products = useProducts(categoryId);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products.data ?? [];
    return q ? list.filter((p) => p.name.toLowerCase().includes(q)) : list;
  }, [products.data, search]);

  const addVariant = (product: Product, variant: ProductVariant, showLabel: boolean) =>
    cart.add({
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      variantLabel: showLabel ? variant.label : undefined,
      unitPrice: toNumber(variant.price),
    });

  /** Sizes are loaded on tap: none → base price, one → that size, several → ask. */
  const handleProductPress = async (product: Product) => {
    if (!outletId || !product.isAvailable) return;
    setResolvingId(product.id);
    try {
      const variants = (
        await queryClient.fetchQuery({
          queryKey: queryKeys.variants(outletId, product.id),
          queryFn: () => getVariants(product.id, outletId),
          staleTime: 30_000,
        })
      ).filter((v) => v.isActive);

      if (variants.length === 0) {
        cart.add({ productId: product.id, name: product.name, unitPrice: product.price });
      } else if (variants.length === 1) {
        if (variants[0].isAvailable) addVariant(product, variants[0], false);
        else onMessage(`${product.name} is out of stock`);
      } else {
        setSizeChoice({ product, variants });
      }
    } catch (error) {
      onMessage(getErrorMessage(error));
    } finally {
      setResolvingId(null);
    }
  };

  const handleSubmit = async () => {
    const ok = await onSubmit({
      customerName: customer.customerName.trim() || undefined,
      customerPhone: customer.customerPhone.trim() || undefined,
    });
    if (ok) {
      setCustomer(EMPTY_CUSTOMER);
      setCartOpen(false);
    }
  };

  const emptyText = products.error
    ? getErrorMessage(products.error)
    : search
      ? "No products match your search."
      : "No products in this category.";

  const sizePicker = (
    <SizePickerDialog
      product={sizeChoice?.product ?? null}
      variants={sizeChoice?.variants ?? []}
      onDismiss={() => setSizeChoice(null)}
      onPick={(variant) => {
        if (sizeChoice) addVariant(sizeChoice.product, variant, true);
        setSizeChoice(null);
      }}
    />
  );

  // ── Landscape / tablet: the web order screen ──
  if (isWide) {
    const columns = gridColumns(menuWidth);
    const cardWidth = menuWidth > 0 ? Math.floor((menuWidth - GRID_PADDING * 2 - GRID_GAP * (columns - 1)) / columns) : 0;

    return (
      <View className="flex-1 flex-row">
        <View
          className="flex-1"
          style={{ backgroundColor: web.pageBg, paddingLeft: insets.left }}
          onLayout={(e) => setMenuWidth(e.nativeEvent.layout.width - insets.left)}
        >
          <View className="gap-3 px-4 pb-1 pt-4">
            <View
              className="flex-row items-center gap-2 rounded-xl px-3"
              style={{ height: 42, backgroundColor: web.surface, borderWidth: 1, borderColor: searchFocused ? web.accent : web.border }}
            >
              <MaterialCommunityIcons name="magnify" size={18} color={web.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search menu items..."
                placeholderTextColor={web.textFaint}
                returnKeyType="search"
                style={{ flex: 1, color: web.textPrim, fontSize: 14, paddingVertical: 0 }}
              />
              {search ? (
                <Pressable onPress={() => setSearch("")} hitSlop={8} accessibilityLabel="Clear search">
                  <MaterialCommunityIcons name="close-circle" size={16} color={web.textFaint} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              <CategoryButton web={web} label="All Items" active={categoryId === null} onPress={() => setCategoryId(null)} />
              {(categories.data ?? []).map((c) => (
                <CategoryButton key={c.id} web={web} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
              ))}
            </ScrollView>
          </View>

          {cardWidth === 0 ? null : products.isLoading ? (
            <Skeleton style={{ flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP, padding: GRID_PADDING }}>
              {Array.from({ length: columns * 2 }, (_, i) => (
                <Bone key={i} width={cardWidth} height={cardWidth * 0.75 + 76} radius={16} />
              ))}
            </Skeleton>
          ) : (
            <FlatList
              key={columns} // numColumns can't change on the fly
              data={visibleProducts}
              keyExtractor={(p) => p.id}
              numColumns={columns}
              columnWrapperStyle={{ gap: GRID_GAP }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: GRID_GAP, padding: GRID_PADDING, paddingBottom: insets.bottom + 16 }}
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  width={cardWidth}
                  quantityInCart={cart.quantityOf(item.id)}
                  loading={resolvingId === item.id}
                  onPress={() => handleProductPress(item)}
                />
              )}
              ListEmptyComponent={
                <View className="items-center gap-2 py-16">
                  <MaterialCommunityIcons name="magnify-close" size={36} color={web.textFaint} />
                  <Text style={{ color: web.textFaint, fontSize: 13, fontWeight: "500", textAlign: "center" }}>{emptyText}</Text>
                </View>
              }
            />
          )}
        </View>

        <View
          style={{
            width: sidebarWidth(width),
            paddingRight: insets.right,
            paddingBottom: insets.bottom,
            backgroundColor: web.sidebar.bg,
            borderLeftWidth: 1,
            borderColor: web.sidebar.border,
          }}
        >
          <ActiveOrderPanel
            cart={cart}
            customer={customer}
            onCustomerChange={setCustomer}
            submitLabel={submitLabel}
            submitIcon={submitIcon}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        </View>

        {sizePicker}
      </View>
    );
  }

  // ── Phone (portrait) ──
  return (
    <View className="flex-1">
      <View className="gap-3 px-4 pb-2 pt-3">
        <Searchbar
          placeholder="Search menu"
          value={search}
          onChangeText={setSearch}
          style={{ backgroundColor: theme.colors.surfaceVariant }}
          inputStyle={{ minHeight: 0 }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          <Chip selected={categoryId === null} showSelectedCheck={false} mode={categoryId === null ? "flat" : "outlined"} onPress={() => setCategoryId(null)}>
            All
          </Chip>
          {(categories.data ?? []).map((c) => (
            <Chip
              key={c.id}
              selected={categoryId === c.id}
              showSelectedCheck={false}
              mode={categoryId === c.id ? "flat" : "outlined"}
              onPress={() => setCategoryId(c.id)}
            >
              {c.name}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {products.isLoading ? (
        <View className="flex-1">
          <ListSkeleton rows={7} />
        </View>
      ) : (
        <FlatList
          data={visibleProducts}
          keyExtractor={(p) => p.id}
          ItemSeparatorComponent={Divider}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 96 }}
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              quantityInCart={cart.quantityOf(item.id)}
              loading={resolvingId === item.id}
              onPress={() => handleProductPress(item)}
              onDecrement={() => cart.decrementProduct(item.id)}
            />
          )}
          ListEmptyComponent={
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center", marginTop: 32 }}>
              {emptyText}
            </Text>
          }
        />
      )}

      {cart.itemCount > 0 ? (
        <Surface
          elevation={3}
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: insets.bottom + 12,
            borderRadius: 16,
            backgroundColor: theme.colors.primary,
          }}
        >
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text variant="titleSmall" style={{ color: theme.colors.onPrimary, fontWeight: "700" }}>
              {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"} · {formatRs(cart.subtotal)}
            </Text>
            <Button mode="contained-tonal" compact icon="cart-outline" onPress={() => setCartOpen(true)}>
              View order
            </Button>
          </View>
        </Surface>
      ) : null}

      {sizePicker}

      <CartSheet
        visible={cartOpen}
        onDismiss={() => setCartOpen(false)}
        cart={cart}
        customer={customer}
        onCustomerChange={setCustomer}
        submitLabel={submitLabel}
        submitIcon={submitIcon}
        submitting={submitting}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

/** Web category button: filled with the accent colour when selected. */
function CategoryButton({ web, label, active, onPress }: { web: WebPalette; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className="rounded-lg px-4 py-2 active:opacity-80"
      style={{
        backgroundColor: active ? web.accent : web.surface2,
        borderWidth: 1,
        borderColor: active ? web.accent : web.border,
      }}
    >
      <Text style={{ color: active ? web.accentText : web.textMuted, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
