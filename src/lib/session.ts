import * as SecureStore from "expo-secure-store";

import type { AuthUser, Outlet } from "../types/auth";

const SESSION_KEY = "pos.session";

/**
 * What survives an app restart. The access token is NOT stored: it lives 15 min,
 * so on start-up we get a fresh one from /auth/refresh (the refresh token is an
 * httpOnly cookie kept by the native cookie store).
 */
export interface StoredSession {
  user: AuthUser;
  outlets: Outlet[];
  activeOutletId: string | null;
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}