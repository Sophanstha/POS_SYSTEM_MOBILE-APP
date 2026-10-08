import { useCallback, useMemo, useReducer } from "react";

import { roundMoney } from "../lib/pos";
import type { OrderItemInput } from "../types/pos";

export interface CartLine {
  key: string;
  productId: string;
  variantId?: string;
  name: string;
  variantLabel?: string;
  unitPrice: number; // preview only — the server prices the order
  quantity: number;
  note: string;
}

export type NewCartLine = Omit<CartLine, "key" | "quantity" | "note">;

type Action =
  | { type: "add"; line: NewCartLine }
  | { type: "change"; key: string; delta: number }
  | { type: "note"; key: string; note: string }
  | { type: "clear" };

const lineKey = (productId: string, variantId?: string) => `${productId}::${variantId ?? ""}`;

function reducer(lines: CartLine[], action: Action): CartLine[] {
  switch (action.type) {
    case "add": {
      const key = lineKey(action.line.productId, action.line.variantId);
      const existing = lines.find((l) => l.key === key);
      if (existing) {
        return lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...lines, { ...action.line, key, quantity: 1, note: "" }];
    }
    case "change":
      return lines
        .map((l) => (l.key === action.key ? { ...l, quantity: l.quantity + action.delta } : l))
        .filter((l) => l.quantity > 0);
    case "note":
      return lines.map((l) => (l.key === action.key ? { ...l, note: action.note } : l));
    case "clear":
      return [];
  }
}

/** Local cart for building an order (dine-in or takeaway). */
export function useCart() {
  const [lines, dispatch] = useReducer(reducer, []);

  const add = useCallback((line: NewCartLine) => dispatch({ type: "add", line }), []);
  const increment = useCallback((key: string) => dispatch({ type: "change", key, delta: 1 }), []);
  const decrement = useCallback((key: string) => dispatch({ type: "change", key, delta: -1 }), []);
  const setNote = useCallback((key: string, note: string) => dispatch({ type: "note", key, note }), []);
  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  const subtotal = useMemo(
    () => roundMoney(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)),
    [lines],
  );
  const itemCount = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);

  /** How many of a product (all sizes) are in the cart — for the badge on the menu. */
  const quantityOf = useCallback(
    (productId: string) => lines.filter((l) => l.productId === productId).reduce((s, l) => s + l.quantity, 0),
    [lines],
  );

  /** Remove one of a product from the menu list — from its most recently added size. */
  const decrementProduct = useCallback(
    (productId: string) => {
      const last = [...lines].reverse().find((l) => l.productId === productId);
      if (last) dispatch({ type: "change", key: last.key, delta: -1 });
    },
    [lines],
  );

  /** Items in the shape the order endpoints expect. */
  const toOrderItems = useCallback(
    (): OrderItemInput[] =>
      lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: l.quantity,
        notes: l.note.trim() || undefined,
      })),
    [lines],
  );

  return { lines, subtotal, itemCount, add, increment, decrement, decrementProduct, setNote, clear, quantityOf, toOrderItems };
}

export type Cart = ReturnType<typeof useCart>;