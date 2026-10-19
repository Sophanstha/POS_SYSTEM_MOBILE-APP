import NetInfo from "@react-native-community/netinfo";
import { MutationCache, onlineManager, QueryClient } from "@tanstack/react-query";
import axios from "axios";

import { haptics } from "./haptics";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { successHaptic?: boolean };
  }
}


onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
);

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      if (mutation.meta?.successHaptic) haptics.success();
    },
    onError: () => haptics.error(),
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
      networkMode: "always",
    },
  },
});