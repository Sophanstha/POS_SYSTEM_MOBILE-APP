import type { PickedImage } from "../types/admin";

/**
 * Menu photos go straight to Cloudinary, same as the web (unsigned upload preset).
 * Only the returned key is saved on the product; the server turns it into the image URL.
 */
const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const FOLDER = "pos/products";

export const MAX_IMAGE_MB = 5;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Upload problem with a message that can be shown as is. */
export class ImageUploadError extends Error {}

const TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** "image/jpeg"… from the picker, or from the file name when the picker doesn't say. */
export function imageTypeOf(image: PickedImage): string {
  if (image.mimeType) return image.mimeType;
  const ext = (image.fileName ?? image.uri).split("?")[0]!.split(".").pop()?.toLowerCase() ?? "";
  return TYPE_BY_EXTENSION[ext] ?? "image/jpeg";
}

/** Uploads the photo and returns its Cloudinary key (saved as the product's imagePublicId). */
export async function uploadProductImage(image: PickedImage): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new ImageUploadError(
      "Photo upload isn't set up. Add EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET to .env and restart Expo.",
    );
  }

  const type = imageTypeOf(image);
  const form = new FormData();
  // React Native sends { uri, name, type } as the file itself.
  form.append("file", { uri: image.uri, name: image.fileName || `menu-item.${type.split("/")[1]}`, type } as unknown as Blob);
  form.append("upload_preset", UPLOAD_PRESET);
  form.append("folder", FOLDER);

  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: form });
  } catch {
    throw new ImageUploadError("Couldn't upload the photo. Check your connection and try again.");
  }

  const data = (await response.json().catch(() => null)) as { public_id?: string; error?: { message?: string } } | null;
  if (!response.ok || !data?.public_id) {
    throw new ImageUploadError(data?.error?.message ?? "Photo upload failed. Please try again.");
  }
  return data.public_id;
}