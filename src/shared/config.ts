import type { SystemId } from "../systems";

/**
 * API address of each business, from .env. Expo only puts EXPO_PUBLIC_ values into the
 * app when they are written out in full like this, so keep one line per business.
 */
const API_URLS: Record<SystemId, string | undefined> = {
  // EXPO_PUBLIC_API_URL is the old name, still read so existing .env files keep working.
  pos: process.env.EXPO_PUBLIC_POS_API_URL ?? process.env.EXPO_PUBLIC_API_URL,
  ims: process.env.EXPO_PUBLIC_IMS_API_URL,
  dms: process.env.EXPO_PUBLIC_DMS_API_URL,
};

const ENV_NAMES: Record<SystemId, string> = {
  pos: "EXPO_PUBLIC_POS_API_URL",
  ims: "EXPO_PUBLIC_IMS_API_URL",
  dms: "EXPO_PUBLIC_DMS_API_URL",
};

/** Base URL of a business's API, e.g. http://192.168.1.20:3000/api (no trailing slash); null when not set. */
export function apiUrlFor(system: SystemId): string | null {
  const url = API_URLS[system]?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

/** Shown on the login page when the business has no API address in .env. */
export function missingApiUrlMessage(system: SystemId): string {
  return `${ENV_NAMES[system]} is not set. Add it to .env and restart Expo with \`npx expo start -c\`.`;
}
