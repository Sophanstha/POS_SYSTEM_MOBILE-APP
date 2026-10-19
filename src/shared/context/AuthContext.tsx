import { createContext, useContext, useMemo, type ReactNode } from "react";

import { ApiSetupError } from "../api/client";

export type AuthStatus = "loading" | "signedOut" | "signedIn";

/** Who is logged in: the part every business has. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

/**
 * What shared code (login page, routing, theme, "Change business") needs from a login.
 * Each business has its own provider that gives this, plus its own extras, e.g.
 * systems/pos/auth/PosAuthProvider (outlets, switching outlet) via usePosAuth().
 */
export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  role: string | null;
  /** The user's screens: a folder under app/<business>/ ("cashier", "owner"… or "unsupported"). */
  appRole: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  /** Forgot password, step 1: email a reset code; returns the message to show. Not set = not offered. */
  requestPasswordReset?: (email: string) => Promise<string>;
  /** Forgot password, step 2: the code from the email and the new password. */
  resetPassword?: (email: string, code: string, newPassword: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * No business login yet: while the saved business is read ("loading", splash is up),
 * before one is picked, or for a business that isn't in the app yet.
 */
export function NoBusinessAuthProvider({ status, children }: { status: "loading" | "signedOut"; children: ReactNode }) {
  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: null,
      role: null,
      appRole: "unsupported",
      login: async () => {
        throw new ApiSetupError("This business isn't available in the app yet.");
      },
      logout: async () => {},
      hasPermission: () => false,
    }),
    [status],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside a business auth provider");
  return ctx;
}
