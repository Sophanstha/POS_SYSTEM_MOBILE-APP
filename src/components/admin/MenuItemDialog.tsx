import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Image, Pressable, Switch, Text, TextInput, View } from "react-native";

import { getErrorMessage } from "../../api/client";
import { useSaveMenuItem } from "../../hooks/useAdmin";
import { ALLOWED_IMAGE_TYPES, ImageUploadError, imageTypeOf, MAX_IMAGE_MB } from "../../lib/cloudinary";
import { useDashboardPalette } from "../../theme/dashboardPalette";
import type { MenuItem, MenuItemForm, PickedImage } from "../../types/admin";
import type { Category } from "../../types/pos";
import { AdminButton, AdminDialog, AdminField, ChoiceField, FieldLabel, useRevealFocusedInput } from "./AdminUI";

type SizeRow = { key: string; id?: string; label: string; price: string };

type Draft = {
  name: string;
  categoryId: string;
  price: string;
  description: string;
  hasSizes: boolean;
  sizes: SizeRow[];
};

/** Up to 8 digits and 2 decimals, like the server accepts. */
const PRICE_RE = /^\d{1,8}(\.\d{1,2})?$/;

let rowCounter = 0;
const newRow = (): SizeRow => ({ key: `new-${++rowCounter}`, label: "", price: "" });

/** "250.00" → "250", "99.5" stays. */
const priceText = (n: number) => String(Number(n.toFixed(2)));

function draftFor(item: MenuItem | null, categories: Category[]): Draft {
  if (!item) {
    return { name: "", categoryId: categories[0]?.id ?? "", price: "", description: "", hasSizes: false, sizes: [newRow(), newRow()] };
  }
  // Same rule as the web: 2 or more sizes = "multiple sizes".
  const hasSizes = item.sizes.length > 1;
  return {
    name: item.name,
    categoryId: item.categoryId,
    price: priceText(item.price),
    description: item.description ?? "",
    hasSizes,
    sizes: hasSizes
      ? item.sizes.map((s) => ({ key: s.id, id: s.id, label: s.label, price: priceText(s.price) }))
      : [newRow(), newRow()],
  };
}

/** Checks the draft like the web / server do; returns the form to save, or what is wrong. */
function toForm(draft: Draft, image: PickedImage | null, removeImage: boolean): MenuItemForm | string {
  const name = draft.name.trim();
  if (!name) return "Enter the item name.";
  if (!draft.categoryId) return "Choose a category.";

  let sizes: MenuItemForm["sizes"] = null;
  let price: number;

  if (draft.hasSizes) {
    const filled = draft.sizes.filter((s) => s.label.trim() || s.price.trim());
    if (filled.some((s) => !s.label.trim() || !s.price.trim())) return "Each size needs a name and a price (or remove the empty row).";
    if (filled.length < 2) return "Add at least 2 sizes with a name and price, or turn off multiple sizes.";
    if (filled.some((s) => s.label.trim().length > 50)) return "A size name can be at most 50 characters.";
    if (filled.some((s) => !PRICE_RE.test(s.price.trim()) || Number(s.price) <= 0)) return "Size prices must be numbers above 0 (up to 2 decimals).";
    sizes = filled.map((s) => ({ id: s.id, label: s.label.trim(), price: Number(s.price) }));
    price = Math.min(...sizes.map((s) => s.price));
  } else {
    if (!PRICE_RE.test(draft.price.trim()) || Number(draft.price) <= 0) return "Enter a price above 0 (up to 2 decimals).";
    price = Number(draft.price);
  }

  return { name, categoryId: draft.categoryId, price, description: draft.description.trim(), sizes, image, removeImage };
}

type MenuItemDialogProps = {
  visible: boolean;
  /** null = add a new item. */
  item: MenuItem | null;
  categories: Category[];
  onDismiss: () => void;
  onSaved: (message: string) => void;
  /** Shows "Delete item" in the dialog. */
  onDelete?: (item: MenuItem) => void;
};

/**
 * The web's "Add New Item" / "Edit Item" dialog: photo (gallery or camera), name, category,
 * one price or several sizes, description. The photo is uploaded when saving.
 */
export default function MenuItemDialog({ visible, item, categories, onDismiss, onSaved, onDelete }: MenuItemDialogProps) {
  const d = useDashboardPalette();
  const save = useSaveMenuItem();

  const [draft, setDraft] = useState<Draft>(() => draftFor(item, categories));
  const [image, setImage] = useState<PickedImage | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh form each time the dialog opens.
  useEffect(() => {
    if (!visible) return;
    setDraft(draftFor(item, categories));
    setImage(null);
    setRemoveImage(false);
    setError(null);
  }, [visible, item, categories]);

  const busy = save.isPending;
  const photo = image?.uri ?? (removeImage ? null : item?.imageUrl ?? null);

  const pick = async (source: "library" | "camera") => {
    setError(null);
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError("Allow camera access for this app in your phone settings to take a photo.");
          return;
        }
      }
      // 4:3 crop, like the menu cards on the web.
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.7 };
      const result =
        source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;

      if (asset.fileSize && asset.fileSize > MAX_IMAGE_MB * 1024 * 1024) {
        setError(`The photo must be under ${MAX_IMAGE_MB}MB.`);
        return;
      }
      const picked: PickedImage = { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName };
      if (!ALLOWED_IMAGE_TYPES.includes(imageTypeOf(picked))) {
        setError("Only JPG, PNG and WebP photos are allowed.");
        return;
      }
      setImage(picked);
      setRemoveImage(false);
    } catch {
      setError(source === "camera" ? "Couldn't open the camera." : "Couldn't open your photos.");
    }
  };

  const clearPhoto = () => {
    setImage(null);
    setRemoveImage(!!item?.imageUrl);
  };

  const updateSize = (index: number, field: "label" | "price", value: string) =>
    setDraft((p) => ({ ...p, sizes: p.sizes.map((s, i) => (i === index ? { ...s, [field]: value } : s)) }));

  const submit = () => {
    const form = toForm(draft, image, removeImage);
    if (typeof form === "string") {
      setError(form);
      return;
    }
    setError(null);
    save.mutate(
      { item, form },
      {
        onSuccess: () => onSaved(item ? `${form.name} saved` : `${form.name} added to the menu`),
        onError: (e) =>
          setError(e instanceof ImageUploadError ? e.message : getErrorMessage(e, "Failed to save the item. Please try again.")),
      },
    );
  };

  return (
    <AdminDialog
      visible={visible}
      onDismiss={() => !busy && onDismiss()}
      icon="silverware-fork-knife"
      title={item ? "Edit Item" : "Add New Item"}
      error={error}
      busy={busy}
      submitLabel={busy ? "Saving…" : item ? "Save Changes" : "Add Item"}
      onSubmit={submit}
      danger={item && onDelete ? { label: "Delete item", icon: "trash-can-outline", onPress: () => onDelete(item) } : undefined}
    >
      {/* Photo */}
      <View>
        <FieldLabel>Photo (optional)</FieldLabel>
        {photo ? (
          <Image
            source={{ uri: photo }}
            accessibilityLabel="Item photo"
            resizeMode="cover"
            style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 10, backgroundColor: d.skeleton }}
          />
        ) : (
          <Pressable
            onPress={() => pick("library")}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Choose a photo"
            className="items-center justify-center gap-1.5 rounded-lg active:opacity-70"
            style={{ width: "100%", aspectRatio: 16 / 7, borderWidth: 2, borderStyle: "dashed", borderColor: d.border, backgroundColor: d.rowExpanded }}
          >
            <MaterialCommunityIcons name="image-plus" size={28} color={d.emerald.icon} />
            <Text style={{ color: d.sub, fontSize: 13, fontWeight: "600" }}>Add a photo</Text>
            <Text style={{ color: d.muted, fontSize: 11 }}>JPG, PNG or WebP · up to {MAX_IMAGE_MB}MB</Text>
          </Pressable>
        )}
        <View className="mt-2.5 flex-row gap-2">
          <AdminButton label="Gallery" icon="image-outline" grow disabled={busy} onPress={() => pick("library")} />
          <AdminButton label="Camera" icon="camera-outline" grow disabled={busy} onPress={() => pick("camera")} />
          {photo ? <AdminButton label="Remove" icon="close" disabled={busy} onPress={clearPhoto} /> : null}
        </View>
      </View>

      <AdminField
        label="Item Name"
        value={draft.name}
        onChangeText={(name) => setDraft((p) => ({ ...p, name }))}
        placeholder="e.g. Iced Matcha"
        maxLength={255}
        editable={!busy}
      />

      <ChoiceField<string>
        label="Category"
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        value={draft.categoryId}
        disabled={busy}
        onChange={(categoryId) => setDraft((p) => ({ ...p, categoryId }))}
      />

      {/* Multiple sizes */}
      <View
        className="flex-row items-center gap-3 rounded-lg px-3.5 py-3"
        style={{ backgroundColor: d.rowExpanded, borderWidth: 1, borderColor: d.border }}
      >
        <MaterialCommunityIcons name="ruler" size={18} color={d.emerald.icon} />
        <Text style={{ flex: 1, color: d.title, fontSize: 13, fontWeight: "600" }}>This item has multiple sizes/variants</Text>
        <Switch
          value={draft.hasSizes}
          disabled={busy}
          onValueChange={(hasSizes) => setDraft((p) => ({ ...p, hasSizes }))}
          trackColor={{ true: d.emerald.edge, false: d.border }}
          thumbColor="#ffffff"
          accessibilityLabel="Multiple sizes"
        />
      </View>

      {draft.hasSizes ? (
        <View className="gap-2">
          <FieldLabel>Sizes & Prices</FieldLabel>
          {draft.sizes.map((size, index) => (
            <View key={size.key} className="flex-row items-center gap-2">
              <SizeInput
                value={size.label}
                onChangeText={(v) => updateSize(index, "label", v)}
                placeholder="e.g. 500ML"
                editable={!busy}
                maxLength={50}
                flex
              />
              <SizeInput
                value={size.price}
                onChangeText={(v) => updateSize(index, "price", v.replace(/[^0-9.]/g, ""))}
                placeholder="Price"
                keyboardType="decimal-pad"
                editable={!busy}
              />
              <Pressable
                onPress={() => setDraft((p) => ({ ...p, sizes: p.sizes.filter((_, i) => i !== index) }))}
                disabled={busy || draft.sizes.length <= 1}
                accessibilityRole="button"
                accessibilityLabel="Remove size"
                hitSlop={6}
                className="h-10 w-10 items-center justify-center rounded-lg active:opacity-60"
                style={{ opacity: draft.sizes.length <= 1 ? 0.3 : 1 }}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={d.error.text} />
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={() => setDraft((p) => ({ ...p, sizes: [...p.sizes, newRow()] }))}
            disabled={busy}
            accessibilityRole="button"
            className="flex-row items-center gap-1.5 self-start py-1 active:opacity-60"
          >
            <MaterialCommunityIcons name="plus" size={16} color={d.link} />
            <Text style={{ color: d.link, fontSize: 13, fontWeight: "600" }}>Add another size</Text>
          </Pressable>
        </View>
      ) : (
        <AdminField
          label="Price (Rs.)"
          icon="cash"
          value={draft.price}
          onChangeText={(price) => setDraft((p) => ({ ...p, price: price.replace(/[^0-9.]/g, "") }))}
          placeholder="e.g. 250"
          keyboardType="decimal-pad"
          editable={!busy}
        />
      )}

      <AdminField
        label="Description (optional)"
        value={draft.description}
        onChangeText={(description) => setDraft((p) => ({ ...p, description }))}
        placeholder="Short description..."
        multiline
        textAlignVertical="top"
        editable={!busy}
      />
    </AdminDialog>
  );
}

/** Compact input for a size row (name / price). */
function SizeInput({
  flex,
  ...props
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  editable: boolean;
  keyboardType?: "decimal-pad";
  maxLength?: number;
  flex?: boolean;
}) {
  const d = useDashboardPalette();
  const reveal = useRevealFocusedInput();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...props}
      onFocus={() => {
        setFocused(true);
        reveal();
      }}
      onBlur={() => setFocused(false)}
      placeholderTextColor={d.input.placeholder}
      style={{
        flex: flex ? 1 : undefined,
        width: flex ? undefined : 100,
        backgroundColor: d.input.bg,
        borderWidth: 1,
        borderColor: focused ? d.hero.bg : d.input.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: d.input.text,
        fontSize: 14,
        opacity: props.editable ? 1 : 0.6,
      }}
    />
  );
}