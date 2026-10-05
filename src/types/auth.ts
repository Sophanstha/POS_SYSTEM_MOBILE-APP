export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
  organizationId: string;
  slug: string;
}

export interface Outlet {
  id: string;
  name: string;
}

/** POST /auth/login */
export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
  role: string | null;
  permissions: string[];
  outlets: Outlet[];
  activeOutletId: string | null;
  requiresOutletSelection: boolean;
}

/** POST /auth/refresh */
export interface RefreshResponse {
  accessToken: string;
  role: string | null;
  permissions: string[];
}

/** Which part of the mobile app a user gets. */
export type AppRole = "waiter" | "cashier" | "unsupported";

export function toAppRole(role: string | null): AppRole {
  if (role === "Waiter") return "waiter";
  // The web middleware sends "All Rounder" to the cashier area too.
  if (role === "Cashier" || role === "All Rounder") return "cashier";
  return "unsupported";
}