import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { setAccessToken, setAuthHandlers } from "../../../shared/api/client";
import { AuthContext, type AuthContextValue, type AuthStatus } from "../../../shared/context/AuthContext";
import { clearSession, loadSession, saveSession } from "../../../shared/lib/session";
import {
  toAppRole,
  type Outlet,
  type PosAppRole,
  type PosSession,
  type PosUser,
} from "../types/auth";
import { posLogin, posLogout, posRefresh, posRequestPasswordReset, posResetPassword } from "./api";

interface PosAuthState {
  status: AuthStatus;
  user: PosUser | null;
  role: string | null;
  permissions: string[];
  outlets: Outlet[];
  activeOutletId: string | null;
}

export interface PosAuthValue extends PosAuthState {
  appRole: PosAppRole;
  activeOutlet: Outlet | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  /** After editing the profile in Settings: shows the new name / email everywhere. */
  updateUser: (
    changes: Partial<Pick<PosUser, "name" | "email">>,
  ) => Promise<void>;
  /** After renaming the outlet in Settings. */
  renameOutlet: (outletId: string, name: string) => Promise<void>;
  /** Owner: work in another outlet (new token for it; every screen then shows that outlet). */
  switchOutlet: (outlet: Outlet) => Promise<void>;
}

const SIGNED_OUT: PosAuthState = {
  status: "signedOut",
  user: null,
  role: null,
  permissions: [],
  outlets: [],
  activeOutletId: null,
};

const PosAuthContext = createContext<PosAuthValue | null>(null);

/**
 * POS login: the user, their POS role and permissions, the outlets and the one they
 * work in. Gives the shared AuthContext too, so the login page and routing work.
 */
export default function PosAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<PosAuthState>({
    ...SIGNED_OUT,
    status: "loading",
  });

  // The outlet the token is for; read by the automatic token refresh.
  const outletRef = useRef<string | null>(null);
  useEffect(() => {
    outletRef.current = state.activeOutletId;
  }, [state.activeOutletId]);

  const resetToSignedOut = useCallback(() => {
    setAccessToken(null);
    queryClient.clear(); // drop the previous user's cached tables/orders
    setState(SIGNED_OUT);
  }, [queryClient]);

  // Leaving POS ("Change business"): forget the token and POS data on this phone's screens.
  useEffect(
    () => () => {
      setAccessToken(null);
      queryClient.clear();
    },
    [queryClient],
  );

  // When a request gets a 401: refresh the token for the current outlet (and keep the
  // role / permissions in sync); sign out when the refresh token is rejected.
  useEffect(() => {
    setAuthHandlers({
      refresh: async () => {
        const data = await posRefresh(outletRef.current);
        setState((prev) => ({
          ...prev,
          role: data.role,
          permissions: data.permissions,
        }));
        return data.accessToken;
      },
      onSessionExpired: () => {
        clearSession("pos").catch(() => {});
        resetToSignedOut();
      },
    });
    return () => setAuthHandlers({});
  }, [resetToSignedOut]);

  // Restore the POS session on app start (or when POS is picked).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await loadSession<PosSession>("pos");
      if (!stored) {
        if (!cancelled) setState(SIGNED_OUT);
        return;
      }

      try {
        outletRef.current = stored.activeOutletId;
        const data = await posRefresh(stored.activeOutletId);
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
          await clearSession("pos").catch(() => {});
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
    const data = await posLogin(email, password);
    outletRef.current = data.activeOutletId;
    await saveSession<PosSession>("pos", {
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
      await posLogout(); // revokes the refresh token + clears the cookie
    } catch {
      // Still log out locally if the server can't be reached.
    }
    await clearSession("pos").catch(() => {});
    resetToSignedOut();
  }, [resetToSignedOut]);

  const hasPermission = useCallback(
    (code: string) =>
      state.role === "Owner" || state.permissions.includes(code),
    [state.role, state.permissions],
  );

  const updateUser = useCallback(
    async (changes: Partial<Pick<PosUser, "name" | "email">>) => {
      if (!state.user) return;
      const user = { ...state.user, ...changes };
      setState((prev) => ({ ...prev, user }));
      await saveSession<PosSession>("pos", {
        user,
        outlets: state.outlets,
        activeOutletId: state.activeOutletId,
      }).catch(() => {});
    },
    [state.user, state.outlets, state.activeOutletId],
  );

  const renameOutlet = useCallback(
    async (outletId: string, name: string) => {
      const outlets = state.outlets.map((o) =>
        o.id === outletId ? { ...o, name } : o,
      );
      setState((prev) => ({ ...prev, outlets }));
      if (state.user) {
        await saveSession<PosSession>("pos", {
          user: state.user,
          outlets,
          activeOutletId: state.activeOutletId,
        }).catch(() => {});
      }
    },
    [state.user, state.outlets, state.activeOutletId],
  );

  const switchOutlet = useCallback(
    async (outlet: Outlet) => {
      const data = await posRefresh(outlet.id); // throws if the server says no; nothing changes then
      outletRef.current = outlet.id;
      const outlets = state.outlets.some((o) => o.id === outlet.id)
        ? state.outlets.map((o) =>
            o.id === outlet.id ? { ...o, name: outlet.name } : o,
          )
        : [...state.outlets, { id: outlet.id, name: outlet.name }];
      setState((prev) => ({
        ...prev,
        activeOutletId: outlet.id,
        role: data.role,
        permissions: data.permissions,
        outlets,
      }));
      if (state.user) {
        await saveSession<PosSession>("pos", {
          user: state.user,
          outlets,
          activeOutletId: outlet.id,
        }).catch(() => {});
      }
    },
    [state.user, state.outlets],
  );

  const appRole = toAppRole(state.role);

  const value = useMemo<PosAuthValue>(
    () => ({
      ...state,
      appRole,
      activeOutlet:
        state.outlets.find((o) => o.id === state.activeOutletId) ?? null,
      login,
      logout,
      hasPermission,
      updateUser,
      renameOutlet,
      switchOutlet,
    }),
    [
      state,
      appRole,
      login,
      logout,
      hasPermission,
      updateUser,
      renameOutlet,
      switchOutlet,
    ],
  );

  // The part shared code needs (login page, routing, theme).
  const shared = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      role: state.role,
      appRole,
      login,
      logout,
      hasPermission,
      requestPasswordReset: posRequestPasswordReset,
      resetPassword: posResetPassword,
    }),
    [state.status, state.user, state.role, appRole, login, logout, hasPermission],
  );

  return (
    <AuthContext.Provider value={shared}>
      <PosAuthContext.Provider value={value}>{children}</PosAuthContext.Provider>
    </AuthContext.Provider>
  );
}

/** The POS login with its extras (outlets, active outlet, switching outlet…). */
export function usePosAuth(): PosAuthValue {
  const ctx = useContext(PosAuthContext);
  if (!ctx) throw new Error("usePosAuth must be used inside <PosAuthProvider>");
  return ctx;
}
