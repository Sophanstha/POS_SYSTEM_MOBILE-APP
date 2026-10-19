import axios from "axios";

import { api, apiBaseUrl, setAccessToken } from "../../../shared/api/client";
import type { LoginResponse, RefreshResponse } from "../types/auth";

/** POST /auth/login, same as the web login. Keeps the access token for the next requests. */
export async function posLogin(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/auth/login", { email, password });
  setAccessToken(data.accessToken);
  return data;
}

/**
 * New access token for an outlet (POST /auth/refresh; the refresh token is an httpOnly
 * cookie). Plain axios, so a 401 here never starts another refresh.
 */
export async function posRefresh(outletId: string | null): Promise<RefreshResponse> {
  const { data } = await axios.post<RefreshResponse>(
    `${apiBaseUrl()}/auth/refresh`,
    { activeOutletId: outletId },
    { withCredentials: true, timeout: 15000 },
  );
  setAccessToken(data.accessToken);
  return data;
}

/** Revokes the refresh token and clears its cookie. */
export async function posLogout(): Promise<void> {
  await api.post("/auth/logout");
}

/**
 * Forgot password, step 1 (same as the web): the server emails a 6-digit code that
 * lasts 10 minutes. It answers the same whether or not the email has an account.
 */
export async function posRequestPasswordReset(email: string): Promise<string> {
  const { data } = await api.post<{ message?: string }>("/auth/forgot-password", { email });
  return data.message ?? "If an account exists with that email, a reset code has been sent.";
}

/** Forgot password, step 2: the 6-digit code and the new password (at least 8 characters). */
export async function posResetPassword(email: string, code: string, newPassword: string): Promise<void> {
  await api.post("/auth/reset-password", { email, code, newPassword });
}
