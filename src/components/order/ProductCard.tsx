import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";

import { formatRs } from "../../lib/pos";
import { useWebPalette } from "../../theme/webPalette";
import type { Product } from "../../types/pos";

type ProductCardProps = {
  product: Product;
  width: number;
  quantityInCart: number;
  /** Sizes are being loaded after a tap. */
  loading: boolean;
  onPress: () => void;
};

/** Menu card like the web grid: photo, name, description, price; ✓ when it's in the order. */
export default function ProductCard({ product, width, quantityInCart, loading, onPress }: ProductCardProps) {
  const p = useWebPalette();
  const [imageFailed, setImageFailed] = useState(false);
  const inCart = quantityInCart > 0;
  const unavailable = !product.isAvailable;

  return (
    <Pressable
      onPress={onPress}
      disabled={unavailable || loading}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}${unavailable ? ", out of stock" : inCart ? `, ${quantityInCart} in order` : ""}`}
      className="overflow-hidden rounded-2xl active:opacity-80"
      style={{
        width,
        backgroundColor: p.surface,
        borderWidth: inCart ? 2 : 1,
        borderColor: inCart ? p.accent : p.border,
        opacity: unavailable ? 0.6 : 1,
      }}
    >
      <View style={{ padding: 8, paddingBottom: 0 }}>
        <View
          className="items-center justify-center overflow-hidden rounded-xl"
          style={{ aspectRatio: 4 / 3, backgroundColor: p.skeleton }}
        >
          {product.imageUrl && !imageFailed ? (
            <Image
              source={{ uri: product.imageUrl }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <MaterialCommunityIcons name="image-off-outline" size={28} color={p.textFaint} />
          )}

          {inCart ? (
            <View
              className="absolute inset-0 items-center justify-center"
              style={{ backgroundColor: p.inCartOverlay }}
            >
              <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: p.accent }}>
                <MaterialCommunityIcons name="check-bold" size={18} color={p.accentText} />
              </View>
              {quantityInCart > 1 ? (
                <Text style={{ marginTop: 4, color: "#ffffff", fontSize: 12, fontWeight: "800" }}>×{quantityInCart}</Text>
              ) : null}
            </View>
          ) : null}

          {unavailable ? (
            <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: "rgba(15,15,17,0.7)" }}>
              <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: "rgba(38,38,38,0.9)" }}>
                <Text style={{ color: "#e5e5e5", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 }}>OUT OF STOCK</Text>
              </View>
            </View>
          ) : null}

          {loading ? (
            <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
              <ActivityIndicator color="#ffffff" />
            </View>
          ) : null}
        </View>
      </View>

      <View className="mt-2 gap-0.5 px-3 pb-3 pt-2" style={{ flexGrow: 1, backgroundColor: p.card.footer }}>
        <Text numberOfLines={1} style={{ color: p.card.title, fontSize: 13, fontWeight: "600" }}>
          {product.name}
        </Text>
        {product.description ? (
          <Text numberOfLines={1} style={{ color: p.card.muted, fontSize: 11 }}>
            {product.description}
          </Text>
        ) : null}
        <Text style={{ color: p.card.price, fontSize: 14, fontWeight: "700", marginTop: 2 }}>
          {product.price > 0 ? formatRs(product.price) : "Choose size"}
        </Text>
      </View>
    </Pressable>
  );
}
