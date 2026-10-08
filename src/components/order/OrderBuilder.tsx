import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import { ActivityIndicator, Button, Chip, Divider, Searchbar, Surface, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../api/client";
import { getVariants } from "../../api/pos";
import type { Cart } from "../../hooks/useCart";
import { useCategories, useProducts } from "../../hooks/useMenu";
import { useOutletId } from "../../hooks/shared";
import { formatRs, toNumber } from "../../lib/pos";
import { queryKeys } from "../../lib/queryKey";
import { useAppTheme } from "../../theme/paperTheme";
import type { Product, ProductVariant } from "../../types/pos";
import CartSheet, { type CustomerDetails } from "./CartSheet";
import ProductRow from "./ProductRow";
import SizePickerDialog from "./SizePickerDialog";

type OrderBuilderProps = {
  cart: Cart;
  submitLabel: string;
  submitIcon: string;
  submitting: boolean;
  /** Return true when the order went through (closes the sheet and clears the customer). */
  onSubmit: (customer: { customerName?: string; customerPhone?: string }) => Promise<boolean>;
  onMessage: (message: string) => void;
};

const EMPTY_CUSTOMER: CustomerDetails = { customerName: "", customerPhone: "" };

/** Menu (categories, search, products) + cart. Used for dine-in now and takeaway later. */
export default function OrderBuilder({ cart, submitLabel, submitIcon, submitting, onSubmit, onMessage }: OrderBuilderProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const outletId = useOutletId();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [sizeChoice, setSizeChoice] = useState<{ product: Product; variants: ProductVariant[] } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerDetails>(EMPTY_CUSTOMER);

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
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
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
              {products.error ? getErrorMessage(products.error) : search ? "No products match your search." : "No products in this category."}
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

      <SizePickerDialog
        product={sizeChoice?.product ?? null}
        variants={sizeChoice?.variants ?? []}
        onDismiss={() => setSizeChoice(null)}
        onPick={(variant) => {
          if (sizeChoice) addVariant(sizeChoice.product, variant, true);
          setSizeChoice(null);
        }}
      />

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