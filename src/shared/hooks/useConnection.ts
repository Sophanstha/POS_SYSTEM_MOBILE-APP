import { onlineManager, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useState, useSyncExternalStore } from "react";

export type Connection = "online" | "offline" | "serverDown";

/** No answer at all (not a 4xx / 5xx): the server couldn't be reached. */
export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

/**
 * "offline"    – the phone has no network (Wi-Fi / data off).
 * "serverDown" – the phone is online but requests get no answer from the POS server.
 */
export function useConnection(): Connection {
  const queryClient = useQueryClient();
  const online = useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
  const [serverDown, setServerDown] = useState(false);

  // Every request result tells us whether the server answered.
  useEffect(() => {
    const onResult = (type: string, error?: unknown) => {
      if (type === "success") setServerDown(false);
      else if (type === "error") setServerDown(isNetworkError(error));
    };
    const offQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated") {
        onResult(event.action.type, "error" in event.action ? event.action.error : undefined);
      }
    });
    const offMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated") {
        onResult(event.action.type, "error" in event.action ? event.action.error : undefined);
      }
    });
    return () => {
      offQueries();
      offMutations();
    };
  }, [queryClient]);

  if (!online) return "offline";
  return serverDown ? "serverDown" : "online";
}