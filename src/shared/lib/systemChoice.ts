import * as SecureStore from "expo-secure-store";

import { isSystemId, type SystemId } from "../../systems";

// SecureStore keys may only contain letters, numbers, ".", "-" and "_".
const SYSTEM_KEY = "app.system";

/** The business picked on this phone, or null when none was picked yet. */
export async function loadSystem(): Promise<SystemId | null> {
  try {
    const saved = await SecureStore.getItemAsync(SYSTEM_KEY);
    return isSystemId(saved) ? saved : null;
  } catch {
    return null;
  }
}

export async function saveSystem(system: SystemId): Promise<void> {
  await SecureStore.setItemAsync(SYSTEM_KEY, system);
}

export async function clearSavedSystem(): Promise<void> {
  await SecureStore.deleteItemAsync(SYSTEM_KEY);
}
