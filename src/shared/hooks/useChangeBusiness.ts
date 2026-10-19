import { useCallback } from "react";

import { useAuth } from "../context/AuthContext";
import { useSystem } from "../context/SystemContext";

/**
 * "Change business": log out of this business first (so its login cookie is revoked and
 * never mixed up with another backend's), then forget the choice. The router then shows
 * "What is your business?" again.
 */
export function useChangeBusiness() {
  const { status, logout } = useAuth();
  const { clearSystem } = useSystem();

  return useCallback(async () => {
    if (status === "signedIn") await logout();
    await clearSystem();
  }, [status, logout, clearSystem]);
}
