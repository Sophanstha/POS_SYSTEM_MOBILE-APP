import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback } from "react";

import { useAuth } from "../context/AuthContext";

/** Active outlet id while signed in; null otherwise (queries stay disabled). */
export function useOutletId(): string | null {
  const { status, activeOutletId } = useAuth();
  return status === "signedIn" ? activeOutletId : null;
}

type KeyFor = (outletId: string) => QueryKey;

/** Returns a function that refetches the given queries for the active outlet. */
export function useInvalidate() {
  const queryClient = useQueryClient();
  const outletId = useOutletId();

  return useCallback(
    (...keys: KeyFor[]) => {
      if (!outletId) return Promise.resolve();
      return Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: key(outletId) })))
        .then(() => undefined);
    },
    [queryClient, outletId],
  );
}