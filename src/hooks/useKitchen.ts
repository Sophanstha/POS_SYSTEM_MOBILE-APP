import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { getStockItems, reportWastage, setKotItemStatus } from "../api/pos";
import { orderItemName } from "../lib/pos";
import { queryKeys } from "../lib/queryKey";
import type { KotStatus, KotTicket } from "../types/pos";
import { useKotTickets } from "./useKot";
import { useInvalidate, useOutletId } from "./shared";

/** The three board columns (web: New Orders / Preparing / Ready to Serve). */
export type KitchenStage = "new" | "preparing" | "ready";

const STAGE_OF: Partial<Record<KotStatus, KitchenStage>> = {
  pending: "new",
  preparing: "preparing",
  ready: "ready",
};

/** One dish on the board. Like the web, every kitchen item is its own card. */
export interface KitchenCard {
  kotItemId: string;
  ticketId: string;
  orderNumber: number;
  isTakeaway: boolean;
  /** "Take away" or the table number. */
  label: string;
  name: string;
  quantity: number;
  notes: string | null;
  stage: KitchenStage;
  /** When the ticket reached the kitchen — for the "12m" timer. */
  createdAt: string;
}

/** Served and cancelled items leave the board; the rest become cards, oldest ticket first. */
export function toKitchenCards(tickets: KotTicket[]): KitchenCard[] {
  return tickets.flatMap((ticket) =>
    ticket.items.flatMap((item) => {
      const stage = STAGE_OF[item.status];
      if (!stage) return [];
      const isTakeaway = ticket.order.orderType === "takeaway";
      return [
        {
          kotItemId: item.id,
          ticketId: ticket.id,
          orderNumber: ticket.order.orderNumber,
          isTakeaway,
          label: isTakeaway ? "Take away" : ticket.order.table?.tableNumber ?? ticket.order.customerName ?? "Table",
          name: orderItemName(item.orderItem),
          quantity: item.orderItem.quantity,
          notes: item.orderItem.notes,
          stage,
          createdAt: ticket.createdAt,
        },
      ];
    }),
  );
}

/** Live kitchen board: open tickets (polled every 5 s) as cards. */
export function useKitchenBoard() {
  const query = useKotTickets();
  const cards = useMemo(() => toKitchenCards(query.data ?? []), [query.data]);
  return { query, cards };
}

/** Start = begin cooking, Done = ready to serve, Undo = back to preparing. */
export type KitchenMove = "start" | "done" | "undo";

/** The server moves an item one step at a time, so "Done" on a new item is two calls. */
const STEPS: Record<KitchenMove, Record<KitchenStage, ("preparing" | "ready")[]>> = {
  start: { new: ["preparing"], preparing: [], ready: [] },
  done: { new: ["preparing", "ready"], preparing: ["ready"], ready: [] },
  undo: { new: [], preparing: [], ready: ["preparing"] },
};

const STATUS_AFTER: Record<KitchenMove, KotStatus> = {
  start: "preparing",
  done: "ready",
  undo: "preparing",
};

/** Move a card. The board updates at once and rolls back if the server says no. */
export function useMoveKitchenItem() {
  const outletId = useOutletId();
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async ({ card, move }: { card: KitchenCard; move: KitchenMove }) => {
      for (const status of STEPS[move][card.stage]) {
        await setKotItemStatus(card.kotItemId, status);
      }
    },
    meta: { successHaptic: true },

    onMutate: async ({ card, move }) => {
      if (!outletId) return { previous: undefined };
      const key = queryKeys.kot(outletId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<KotTicket[]>(key);
      const status = STATUS_AFTER[move];
      queryClient.setQueryData<KotTicket[]>(key, (old) =>
        old?.map((t) =>
          t.id !== card.ticketId
            ? t
            : { ...t, items: t.items.map((i) => (i.id === card.kotItemId ? { ...i, status } : i)) },
        ),
      );
      return { previous };
    },

    onError: (_error, _vars, context) => {
      if (outletId && context?.previous) queryClient.setQueryData(queryKeys.kot(outletId), context.previous);
    },

    // Waiters and the cashier see "Food ready" from the same tickets.
    onSettled: () => invalidate(queryKeys.kot, queryKeys.tableOrdersAll),
  });
}

/** Stock items for the wastage form (loaded when the form opens). */
export function useStockItems(enabled: boolean) {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.stockItems(outletId ?? ""),
    queryFn: getStockItems,
    enabled: enabled && !!outletId,
    staleTime: 0,
  });
}

export function useReportWastage() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: ({ stockItemId, quantity, note }: { stockItemId: string; quantity: number; note?: string }) =>
      reportWastage(stockItemId, { quantity, note }),
    meta: { successHaptic: true },
    onSuccess: () => invalidate(queryKeys.stockItems),
  });
}