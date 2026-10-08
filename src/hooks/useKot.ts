import { useMutation, useQuery } from "@tanstack/react-query";

import { getKotTickets, setKotItemStatus, setKotTicketStatus } from "../api/pos";
import { isOpenTicket } from "../lib/pos";
import type { KotStatus } from "../types/pos";
import { useInvalidate, useOutletId } from "./shared";
import { POLL_MS, queryKeys } from "../lib/queryKey";

/** Open kitchen tickets (not served/cancelled). Polls every 5 s. */
export function useKotTickets() {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.kot(outletId ?? ""),
    queryFn: getKotTickets,
    enabled: !!outletId,
    refetchInterval: POLL_MS,
    select: (tickets) => tickets.filter(isOpenTicket),
  });
}

/** Whole ticket, e.g. takeaway picked up → "served". */
export function useSetKotTicketStatus() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: KotStatus }) =>
      setKotTicketStatus(ticketId, status),
    onSettled: () => invalidate(queryKeys.kot, queryKeys.tableOrdersAll),
  });
}

/** One item, e.g. waiter marks a dish delivered → "served" (or back to "ready"). */
export function useSetKotItemStatus() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: ({ kotItemId, status }: { kotItemId: string; status: "preparing" | "ready" | "served" }) =>
      setKotItemStatus(kotItemId, status),
    onSettled: () => invalidate(queryKeys.kot, queryKeys.tableOrdersAll),
  });
}
