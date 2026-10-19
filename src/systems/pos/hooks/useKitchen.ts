import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { getProducts, getRecipeItems, getStockItems, getVariants, reportWastage, setKotItemStatus } from "../api/pos";
import { orderItemName } from "../lib/pos";
import { queryKeys } from "../lib/queryKey";
import type { KotStatus, KotTicket } from "../types/pos";
import { useKotTickets } from "./useKot";
import { useInvalidate, useOutletId } from "./outletScope";

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

/** A dish in the wastage form: one entry per size, like the web ("Pizza (Large)"). */
export interface WastageMenuItem {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
}

/** Dishes for the "Menu Item" tab (loaded only when that tab is opened). */
export function useWastageMenuItems(enabled: boolean) {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.wastageMenuItems(outletId ?? ""),
    queryFn: async (): Promise<WastageMenuItem[]> => {
      const products = await getProducts();
      const lists = await Promise.all(
        products.map(async (p) => {
          const variants = await getVariants(p.id).catch(() => []);
          return variants.length > 0
            ? variants.map((v) => ({ id: `${p.id}_${v.id}`, productId: p.id, variantId: v.id, name: `${p.name} (${v.label})` }))
            : [{ id: p.id, productId: p.id, variantId: null, name: p.name }];
        }),
      );
      return lists.flat();
    },
    enabled: enabled && !!outletId,
    staleTime: 5 * 60_000,
  });
}

/** Thrown when a dish has no recipe, so there is nothing to take off the stock. */
export class NoRecipeError extends Error {
  constructor() {
    super("No recipe found for this menu item. Cannot deduct ingredients.");
  }
}

export type WastageInput =
  | { kind: "ingredient"; stockItemId: string; quantity: number; note: string }
  | { kind: "menu_item"; item: WastageMenuItem; dishes: number; note: string };

/**
 * Ingredient: take it off the stock. Menu item (like the web): read the dish's recipe
 * and take every ingredient × number of dishes off the stock.
 */
export function useReportWastage() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async (input: WastageInput) => {
      if (input.kind === "ingredient") {
        await reportWastage(input.stockItemId, { quantity: input.quantity, note: input.note });
        return;
      }
      const recipe = await getRecipeItems(input.item.productId, input.item.variantId);
      if (recipe.length === 0) throw new NoRecipeError();
      await Promise.all(
        recipe.map((r) => reportWastage(r.stockItemId, { quantity: r.quantity * input.dishes, note: input.note })),
      );
    },
    meta: { successHaptic: true },
    onSuccess: () => invalidate(queryKeys.stockItems),
  });
}
