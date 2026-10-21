import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";

import { AdminButton, AdminError } from "../../../../shared/components/AdminUI";
import { useDashboardPalette } from "../../../../shared/theme/dashboardPalette";
import { usePaymentQr, useSetPaymentQr } from "../../hooks/usePaymentQr";
import { ALLOWED_IMAGE_TYPES, imageTypeOf, MAX_IMAGE_MB } from "../../lib/cloudinary";
import type { PickedImage } from "../../types/admin";

const EXTENSION: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * Manager / Owner Settings → Payment QR: the shop's Fonepay / eSewa / Khalti QR, shown to the
 * customer when they pay by QR. Saved on this phone only (per outlet), so add it on every
 * phone that takes payments. Cashiers can't change it.
 */
export default function PaymentQrSettings({ onSaved }: { onSaved: (message: string) => void }) {
  const d = useDashboardPalette();
  const qr = usePaymentQr();
  const save = useSetPaymentQr();
  const [error, setError] = useState<string | null>(null);

  const busy = save.isPending;

  const pick = async (source: "library" | "camera") => {
    setError(null);
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return setError("Allow camera access for this app in your phone settings to take a photo.");
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 };
      const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;
      if (asset.fileSize && asset.fileSize > MAX_IMAGE_MB * 1024 * 1024) return setError(`The picture must be under ${MAX_IMAGE_MB}MB.`);
      const picked: PickedImage = { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName };
      const type = imageTypeOf(picked);
      if (!ALLOWED_IMAGE_TYPES.includes(type)) return setError("Only JPG, PNG and WebP images are allowed.");
      save.mutate(
        { uri: asset.uri, extension: EXTENSION[type] ?? "jpg" },
        {
          onSuccess: () => onSaved("Payment QR saved on this phone."),
          onError: () => setError("Couldn't save the QR picture on this phone."),
        },
      );
    } catch {
      setError(source === "camera" ? "Couldn't open the camera." : "Couldn't open your photos.");
    }
  };

  const remove = () => {
    setError(null);
    save.mutate(null, {
      onSuccess: () => onSaved("Payment QR removed from this phone."),
      onError: () => setError("Couldn't remove the QR picture."),
    });
  };

  if (qr.isLoading) return <ActivityIndicator color={d.link} style={{ alignSelf: "flex-start" }} />;

  return (
    <View className="gap-4">
      {error ? <AdminError text={error} /> : null}

      <View className="items-center gap-3">
        {qr.data ? (
          <View className="rounded-2xl bg-white p-3" style={{ borderWidth: 1, borderColor: d.border }}>
            <Image source={{ uri: qr.data }} accessibilityLabel="Shop payment QR code" resizeMode="contain" style={{ width: 180, height: 180 }} />
          </View>
        ) : (
          <View className="h-[180px] w-[180px] items-center justify-center gap-2 rounded-2xl" style={{ backgroundColor: d.skeleton, borderWidth: 1, borderColor: d.border }}>
            <MaterialCommunityIcons name="qrcode-plus" size={40} color={d.muted} />
            <Text style={{ color: d.muted, fontSize: 12 }}>No QR added yet</Text>
          </View>
        )}
        <Text style={{ color: d.muted, fontSize: 12, textAlign: "center" }}>
          Add your shop's Fonepay / eSewa / Khalti QR. It shows on the payment screen when a customer pays by QR.
        </Text>
      </View>

      <View className="flex-row gap-2">
        <AdminButton label="Gallery" icon="image-outline" grow disabled={busy} onPress={() => pick("library")} />
        <AdminButton label="Camera" icon="camera-outline" grow disabled={busy} onPress={() => pick("camera")} />
      </View>
      {qr.data ? <AdminButton label="Remove QR" icon="close" variant="danger" disabled={busy} onPress={remove} /> : null}

      <View className="flex-row items-start gap-2">
        <MaterialCommunityIcons name="cellphone-information" size={14} color={d.muted} style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, color: d.muted, fontSize: 11 }}>
          Saved on this phone only, for this outlet. Add it on every phone that takes payments.
        </Text>
      </View>
    </View>
  );
}