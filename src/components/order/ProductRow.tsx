import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { ActivityIndicator, Badge, IconButton, Text } from "react-native-paper";

import { formatRs } from "../../lib/pos";
import { useAppTheme } from "../../theme/paperTheme";
import type { Product } from "../../types/pos";

type ProductRowProps = {
  product: Product;
  quantityInCart: number;
  loading: boolean;
  onPress: () => void;
  onDecrement: () => void;
};

export default function ProductRow({ product, quantityInCart, loading, onPress, onDecrement }: ProductRowProps) {
  const theme = useAppTheme();
  const unavailable = !product.isAvailable;
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      disabled={unavailable || loading}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}${unavailable ? ", unavailable" : ""}`}
      className="flex-row items-center gap-3 px-4 py-3 active:opacity-70"
      style={{ opacity: unavailable ? 0.45 : 1 }}
    >
      {product.imageUrl && !imageFailed ? (
        <Image
          source={{ uri: product.imageUrl }}
          className="h-14 w-14 rounded-lg"
          onError={(e) => {
            console.warn(`Image failed for ${product.name}:`, product.imageUrl, e.nativeEvent.error);
            setImageFailed(true);
          }}
        />
      ) : (
        <View
          className="h-14 w-14 items-center justify-center rounded-lg"
          style={{ backgroundColor: theme.colors.surfaceVariant }}
        >
          <MaterialCommunityIcons name="food-outline" size={24} color={theme.colors.onSurfaceVariant} />
        </View>
      )}

      <View className="flex-1 gap-0.5">
        <Text variant="titleSmall" numberOfLines={1} style={{ color: theme.colors.onSurface }}>
          {product.name}
        </Text>
        {product.description ? (
          <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
            {product.description}
          </Text>
        ) : null}
        <Text variant="labelLarge" style={{ color: unavailable ? theme.colors.error : theme.colors.primary }}>
          {unavailable ? "Unavailable" : product.price > 0 ? formatRs(product.price) : "Choose size"}
        </Text>
      </View>

      <View className="flex-row items-center">
        {quantityInCart > 0 && !loading ? (
          <IconButton
            icon="minus"
            mode="outlined"
            size={16}
            onPress={onDecrement}
            accessibilityLabel={`Remove one ${product.name}`}
          />
        ) : null}
        <View className="h-9 w-9 items-center justify-center">
          {loading ? (
            <ActivityIndicator size="small" />
          ) : quantityInCart > 0 ? (
            <Badge size={28} style={{ backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }}>
              {quantityInCart}
            </Badge>
          ) : (
            <MaterialCommunityIcons name="plus-circle-outline" size={28} color={theme.colors.onSurfaceVariant} />
          )}
        </View>
      </View>
    </Pressable>
  );
}