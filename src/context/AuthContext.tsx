import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  api,
  refreshSession,
  setAccessToken,
  setActiveOutletId,
  setAuthHandlers,
} from "../api/client";
import { clearSession, loadSession, saveSession } from "../lib/session";
import {
  toAppRole,
  type AppRole,
  type AuthUser,
  type LoginResponse,
  type Outlet,
} from "../types/auth";

export type AuthStatus = "loading" | "signedOut" | "signedIn";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  role: string | null;
  permissions: string[];
  outlets: Outlet[];
  activeOutletId: string | null;
}

interface AuthContextValue extends AuthState {
  appRole: AppRole;
  activeOutlet: Outlet | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (code: string) => boolean;
}

const SIGNED_OUT: AuthState = {
  status: "signedOut",
  user: null,
  role: null,
  permissions: [],
  outlets: [],
  activeOutletId: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ ...SIGNED_OUT, status: "loading" });

  const resetToSignedOut = useCallback(() => {
    setAccessToken(null);
    setActiveOutletId(null);
    queryClient.clear(); // drop the previous user's cached tables/orders
    setState(SIGNED_OUT);
  }, [queryClient]);

  // Keep role/permissions in sync when the API client refreshes the token,
  // and sign out when the refresh token is rejected.
  useEffect(() => {
    setAuthHandlers({
      onRefreshed: (data) =>
        setState((prev) => ({ ...prev, role: data.role, permissions: data.permissions })),
      onSessionExpired: () => {
        clearSession().catch(() => {});
        resetToSignedOut();
      },
    });
    return () => setAuthHandlers({});
  }, [resetToSignedOut]);

  // Restore the session on app start.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await loadSession();
      if (!stored) {
        if (!cancelled) setState(SIGNED_OUT);
        return;
      }

      try {
        setActiveOutletId(stored.activeOutletId);
        const data = await refreshSession(stored.activeOutletId);
        if (cancelled) return;
        setState({
          status: "signedIn",
          user: stored.user,
          outlets: stored.outlets,
          activeOutletId: stored.activeOutletId,
          role: data.role,
          permissions: data.permissions,
        });
      } catch (err) {
        if (cancelled) return;
        // 401 = refresh token gone/expired → forget the session.
        // Anything else (offline, server down) → keep it so the next start can retry.
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          await clearSession().catch(() => {});
        }
        resetToSignedOut();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resetToSignedOut]);

  // Same as the web login: store what the server returns and go straight in.
  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<LoginResponse>("/auth/login", { email, password });

    setAccessToken(data.accessToken);
    setActiveOutletId(data.activeOutletId);
    await saveSession({
      user: data.user,
      outlets: data.outlets,
      activeOutletId: data.activeOutletId,
    });

    setState({
      status: "signedIn",
      user: data.user,
      role: data.role,
      permissions: data.permissions,
      outlets: data.outlets,
      activeOutletId: data.activeOutletId,
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout"); // revokes the refresh token + clears the cookie
    } catch {
      // Still log out locally if the server can't be reached.
    }
    await clearSession().catch(() => {});
    resetToSignedOut();
  }, [resetToSignedOut]);

  const hasPermission = useCallback(
    (code: string) => state.role === "Owner" || state.permissions.includes(code),
    [state.role, state.permissions],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      appRole: toAppRole(state.role),
      activeOutlet: state.outlets.find((o) => o.id === state.activeOutletId) ?? null,
      login,
      logout,
      hasPermission,
    }),
    [state, login, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}