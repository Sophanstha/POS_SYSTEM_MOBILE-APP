import { Directory, File, Paths } from "expo-file-system";

/**
 * The shop's payment QR picture (Fonepay / eSewa / Khalti…) is kept on this phone only,
 * one per outlet, in the app's own storage. Nothing is sent to the server.
 */
const folder = (outletId: string) => new Directory(Paths.document, "payment-qr", outletId);

/** The saved QR picture of this outlet, or null when none was added on this phone. */
export function getPaymentQr(outletId: string): string | null {
  const dir = folder(outletId);
  if (!dir.exists) return null;
  const file = dir.list().find((entry): entry is File => entry instanceof File);
  return file?.uri ?? null;
}

/** Copies the picked picture into the app's storage (the picker's copy can be cleared by the phone). */
export async function savePaymentQr(outletId: string, pickedUri: string, extension: string): Promise<string> {
  const dir = folder(outletId);
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true });
  // A new name each time, so the screen never shows the old picture from its cache.
  const target = new File(dir, `qr-${Date.now()}.${extension}`);
  await new File(pickedUri).copy(target);
  return target.uri;
}

export function removePaymentQr(outletId: string) {
  const dir = folder(outletId);
  if (dir.exists) dir.delete();
}