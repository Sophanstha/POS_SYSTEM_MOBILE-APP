import axios, { type InternalAxiosRequestConfig } from "axios";

import { API_URL } from "../config";
import type { RefreshResponse } from "../types/auth";

let accessToken: string | null = null;
let activeOutletId: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setActiveOutletId(outletId: string | null) {
  activeOutletId = outletId;
}

type AuthHandlers = {
  onRefreshed?: (data: RefreshResponse) => void;
  onSessionExpired?: () => void;
};
let handlers: AuthHandlers = {};

export function setAuthHandlers(next: AuthHandlers) {
  handlers = next;
}

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, 
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});


let refreshPromise: Promise<RefreshResponse> | null = null;

export function refreshSession(outletId: string | null = activeOutletId): Promise<RefreshResponse> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<RefreshResponse>(
        `${API_URL}/auth/refresh`,
        { activeOutletId: outletId },
        { withCredentials: true, timeout: 15000 },
      )
      .then(({ data }) => {
        accessToken = data.accessToken;
        activeOutletId = outletId;
        return data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

const NO_RETRY = ["/auth/login", "/auth/refresh", "/auth/logout"];

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as RetryConfig | undefined;

    if (
      !axios.isAxiosError(error) ||
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      NO_RETRY.some((path) => original.url?.includes(path))
    ) {
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      const data = await refreshSession();
      handlers.onRefreshed?.(data);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (refreshError) {
      // Only a rejected refresh token ends the session; a network blip does not.
      if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401) {
        handlers.onSessionExpired?.();
      }
      return Promise.reject(refreshError);
    }
  },
);

export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return "Can't reach the server. Check your connection.";

    const apiError = (err.response.data as { error?: unknown } | undefined)?.error;
    if (typeof apiError === "string") return apiError;

    if (apiError && typeof apiError === "object") {
      const { formErrors, fieldErrors } = apiError as {
        formErrors?: string[];
        fieldErrors?: Record<string, string[] | undefined>;
      };
      const first = formErrors?.[0] ?? Object.values(fieldErrors ?? {}).flat()[0];
      if (first) return first;
    }
  }
  return fallback;
}