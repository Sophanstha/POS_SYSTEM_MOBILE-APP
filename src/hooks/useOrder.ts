import { useMutation, useQuery } from "@tanstack/react-query";

import {
  cancelOrder,
  createDineInOrder,
  createTakeawayOrder,
  getOrderHistory,
  getTableOrders,
} from "../api/pos";
import type { CreateDineInOrderInput, CreateTakeawayOrderInput } from "../types/pos";
import { useInvalidate, useOutletId } from "./shared";
import { POLL_MS, queryKeys } from "../lib/queryKey";

/** Open orders on one table (with their kitchen tickets). Polls every 5 s. */
export function useTableOrders(tableId: string | null) {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.tableOrders(outletId ?? "", tableId ?? ""),
    queryFn: () => getTableOrders(tableId!),
    enabled: !!outletId && !!tableId,
    refetchInterval: POLL_MS,
  });
}

/** Order history for a date range (YYYY-MM-DD). Server returns the newest 50. */
export function useOrderHistory(range: { startDate?: string; endDate?: string }) {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.history(outletId ?? "", range.startDate, range.endDate),
    queryFn: () => getOrderHistory(range),
    enabled: !!outletId,
  });
}

/** Send a dine-in order to the kitchen. Server sets the table to occupied. */
export function useCreateDineInOrder() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: (input: CreateDineInOrderInput) => createDineInOrder(input),
    onSuccess: () =>
      invalidate(queryKeys.tables, queryKeys.kot, queryKeys.tableOrdersAll, queryKeys.variantsAll, queryKeys.historyAll),
  });
}

/** Create and pay a takeaway order in one go. */
export function useCreateTakeawayOrder() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: (input: CreateTakeawayOrderInput) => createTakeawayOrder(input),
    onSuccess: () => invalidate(queryKeys.kot, queryKeys.variantsAll, queryKeys.historyAll),
  });
}

/** Cancel an open order. Server cancels its tickets and frees the table if it was the last order. */
export function useCancelOrder() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId),
    onSettled: () =>
      invalidate(queryKeys.tables, queryKeys.kot, queryKeys.tableOrdersAll, queryKeys.variantsAll, queryKeys.historyAll),
  });
}