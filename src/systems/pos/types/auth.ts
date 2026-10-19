import type { AuthUser } from "../../../shared/context/AuthContext";

/** The POS user: the shared fields plus the organisation (business) they belong to. */
export interface PosUser extends AuthUser {
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
  user: PosUser;
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

/** What the POS saves on the phone to stay logged in (see shared/lib/session). */
export interface PosSession {
  user: PosUser;
  outlets: Outlet[];
  activeOutletId: string | null;
}

/** Which part of the mobile app a user gets: a folder under app/pos/. */
export type PosAppRole =
  | "waiter"
  | "cashier"
  | "kitchen"
  | "manager"
  | "owner"
  | "unsupported";

export function toAppRole(role: string | null): PosAppRole {
  if (role === "Waiter") return "waiter";
  // The web middleware sends "All Rounder" to the cashier area too.
  if (role === "Cashier" || role === "All Rounder") return "cashier";
  if (role === "Kitchen Crew") return "kitchen";
  if (role === "Manager") return "manager";
  if (role === "Owner") return "owner";
  return "unsupported";
}
