import * as SecureStore from "expo-secure-store";

import type { SystemId } from "../../systems";

/** Each business keeps its own login on the phone: "pos.session", "ims.session", "dms.session". */
const sessionKey = (system: SystemId) => `${system}.session`;

/**
 * What survives an app restart; each business decides what it saves (POS: the user,
 * the outlets and the active outlet). Access tokens are NOT saved: they are short-lived,
 * so on start-up a fresh one comes from the backend's refresh (the refresh token is an
 * httpOnly cookie kept by the native cookie store).
 */
export async function loadSession<T>(system: SystemId): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(sessionKey(system));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function saveSession<T>(system: SystemId, session: T): Promise<void> {
  await SecureStore.setItemAsync(sessionKey(system), JSON.stringify(session));
}

export async function clearSession(system: SystemId): Promise<void> {
  await SecureStore.deleteItemAsync(sessionKey(system));
}
