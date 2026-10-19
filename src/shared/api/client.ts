import axios, { type InternalAxiosRequestConfig } from "axios";

import type { SystemId } from "../../systems";
import { apiUrlFor, missingApiUrlMessage } from "../config";

let accessToken: string | null = null;

/** The API of the chosen business; null until a business is chosen (or its address is missing). */
let baseUrl: string | null = null;
let apiSystem: SystemId | null = null;
const NO_BUSINESS = "Choose your business first.";
let setupMessage = NO_BUSINESS;

/** No API address for the chosen business: the message says what to add to .env. */
export class ApiSetupError extends Error {}

/**
 * Point every request at the chosen business's backend. Called when the business is
 * picked or changed; a different business never reuses the previous one's token.
 */
export function setApiSystem(system: SystemId | null) {
  if (system === apiSystem) return;
  apiSystem = system;
  baseUrl = system ? apiUrlFor(system) : null;
  setupMessage = system ? missingApiUrlMessage(system) : NO_BUSINESS;
  api.defaults.baseURL = baseUrl ?? undefined;
  accessToken = null;
  refreshPromise = null;
}

/** Address of the chosen business's API, for calls made outside `api` (e.g. the token refresh). */
export function apiBaseUrl(): string {
  if (!baseUrl) throw new ApiSetupError(setupMessage);
  return baseUrl;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** Set by the chosen business's login provider (each backend refreshes its token its own way). */
type AuthHandlers = {
  /** Gets a new access token from the backend (the refresh token is an httpOnly cookie). */
  refresh?: () => Promise<string>;
  /** The backend rejected the refresh token: the user has to log in again. */
  onSessionExpired?: () => void;
};
let handlers: AuthHandlers = {};

export function setAuthHandlers(next: AuthHandlers) {
  handlers = next;
}

// The address is set by setApiSystem once a business is chosen.
export const api = axios.create({
  withCredentials: true,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (!baseUrl) throw new ApiSetupError(setupMessage);
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshPromise: Promise<string> | null = null;

/** A new access token; one refresh at a time, however many requests got a 401 together. */
export function refreshAccessToken(): Promise<string> {
  const refresh = handlers.refresh;
  if (!refresh) return Promise.reject(new Error("Not signed in."));
  if (!refreshPromise) {
    refreshPromise = refresh()
      .then((token) => {
        accessToken = token;
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

const NO_RETRY = ["/auth/login", "/auth/refresh", "/auth/logout", "/auth/forgot-password", "/auth/reset-password"];

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
      const token = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch (refreshError) {
      // Only a rejected refresh token ends the session; a network blip does not.
      if (
        axios.isAxiosError(refreshError) &&
        refreshError.response?.status === 401
      ) {
        handlers.onSessionExpired?.();
      }
      return Promise.reject(refreshError);
    }
  },
);

export function getErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (err instanceof ApiSetupError) return err.message;
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return err.code === "ECONNABORTED"
        ? "The server took too long to answer. Please try again."
        : "Can't reach the server. Check your connection.";
    }
    const apiError = (err.response.data as { error?: unknown } | undefined)
      ?.error;
    if (typeof apiError === "string") return apiError;

    if (apiError && typeof apiError === "object") {
      const { formErrors, fieldErrors } = apiError as {
        formErrors?: string[];
        fieldErrors?: Record<string, string[] | undefined>;
      };
      const first =
        formErrors?.[0] ?? Object.values(fieldErrors ?? {}).flat()[0];
      if (first) return first;
    }
  }
  return fallback;
}
