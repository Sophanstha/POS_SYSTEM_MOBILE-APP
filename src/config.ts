const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error(
    "EXPO_PUBLIC_API_URL is not set. Add it to .env and restart Expo with `npx expo start -c`.",
  );
}

/** Base URL of the POS API, e.g. http://192.168.1.20:3000/api (no trailing slash). */
export const API_URL = apiUrl.replace(/\/+$/, "");