import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";

import { getErrorMessage } from "../../../../shared/api/client";
import { useOrganization, useUpdateOrganization } from "../../hooks/useAdmin";
import { ALLOWED_IMAGE_TYPES, ImageUploadError, imageTypeOf, MAX_IMAGE_MB } from "../../lib/cloudinary";
import { useDashboardPalette } from "../../../../shared/theme/dashboardPalette";
import type { PickedImage } from "../../types/admin";
import { AdminButton, AdminError, AdminField, FieldLabel } from "../../../../shared/components/AdminUI";

/** "Gourmet Kitchen" → "GK" */
const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("") || "?";

/**
 * Owner Settings → Organization, like the web "Profile & Security": business name and logo
 * (shown at the top of the menu). The logo is uploaded to Cloudinary when saving.
 */
export default function OrganizationSettings({ onSaved }: { onSaved: (message: string) => void }) {
  const d = useDashboardPalette();
  const org = useOrganization();
  const save = useUpdateOrganization();

  const [name, setName] = useState("");
  const [logo, setLogo] = useState<PickedImage | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fill the form once the organisation has loaded.
  useEffect(() => {
    if (org.data) setName(org.data.name ?? "");
  }, [org.data]);

  const busy = save.isPending;
  const shown = logo?.uri ?? (removeLogo ? null : org.data?.imageUrl ?? null);

  const pick = async (source: "library" | "camera") => {
    setError(null);
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return setError("Allow camera access for this app in your phone settings to take a photo.");
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
      const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;
      if (asset.fileSize && asset.fileSize > MAX_IMAGE_MB * 1024 * 1024) return setError(`The logo must be under ${MAX_IMAGE_MB}MB.`);
      const picked: PickedImage = { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName };
      if (!ALLOWED_IMAGE_TYPES.includes(imageTypeOf(picked))) return setError("Only JPG, PNG and WebP images are allowed.");
      setLogo(picked);
      setRemoveLogo(false);
    } catch {
      setError(source === "camera" ? "Couldn't open the camera." : "Couldn't open your photos.");
    }
  };

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return setError("The business name must be at least 2 characters.");
    setError(null);
    save.mutate(
      { name: trimmed, logo, removeLogo },
      {
        onSuccess: () => {
          setLogo(null);
          setRemoveLogo(false);
          onSaved("Organization updated successfully.");
        },
        onError: (e) => setError(e instanceof ImageUploadError ? e.message : getErrorMessage(e, "Failed to update the organization.")),
      },
    );
  };

  if (org.isLoading) return <ActivityIndicator color={d.link} style={{ alignSelf: "flex-start" }} />;

  return (
    <>
      {error ? <AdminError text={error} /> : null}
      {org.error ? <AdminError text={getErrorMessage(org.error, "Couldn't load the organization.")} /> : null}

      <View>
        <FieldLabel>Logo</FieldLabel>
        <View className="flex-row items-center gap-4">
          {shown ? (
            <Image source={{ uri: shown }} accessibilityLabel="Business logo" resizeMode="cover" style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: d.skeleton }} />
          ) : (
            <View className="h-[72px] w-[72px] items-center justify-center rounded-2xl" style={{ backgroundColor: d.brand.tile, borderWidth: 1, borderColor: d.brand.edge }}>
              <Text style={{ color: d.link, fontSize: 22, fontWeight: "800" }}>{initials(name)}</Text>
            </View>
          )}
          <View className="flex-1 gap-2">
            <View className="flex-row gap-2">
              <AdminButton label="Gallery" icon="image-outline" grow disabled={busy} onPress={() => pick("library")} />
              <AdminButton label="Camera" icon="camera-outline" grow disabled={busy} onPress={() => pick("camera")} />
            </View>
            {shown ? (
              <AdminButton
                label="Remove logo"
                icon="close"
                disabled={busy}
                onPress={() => {
                  setLogo(null);
                  setRemoveLogo(!!org.data?.imageUrl);
                }}
              />
            ) : null}
          </View>
        </View>
        <Text style={{ color: d.muted, fontSize: 11, marginTop: 6 }}>Square image, JPG / PNG / WebP up to {MAX_IMAGE_MB}MB. Shown at the top of the menu.</Text>
      </View>

      <AdminField label="Business Name" icon="domain" value={name} onChangeText={setName} maxLength={255} editable={!busy} />

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <MaterialCommunityIcons name="link-variant" size={14} color={d.muted} />
          <Text style={{ color: d.muted, fontSize: 12 }}>{org.data?.slug ?? ""}</Text>
        </View>
        <AdminButton label="Save Organization" icon="content-save-outline" variant="primary" loading={busy} onPress={submit} />
      </View>
    </>
  );
}
