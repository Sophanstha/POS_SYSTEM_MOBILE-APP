import type {
  DiningTable,
  KotStatus,
  KotTicket,
  OutletDetails,
  PaymentMethod,
  TableStatus,
} from "../types/pos";

// ── Money ──

/** Server numerics arrive as strings ("12.50"). */
export function toNumber(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : parseFloat(value ?? "");
  return Number.isFinite(n) ? n : 0;
}

/** Round to paisa the same way the web does. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatRs(value: string | number | null | undefined): string {
  return `Rs.${toNumber(value).toFixed(2)}`;
}

/** Tax % the server will charge (0 when the outlet has tax turned off). */
export function outletTaxRate(outlet: OutletDetails | undefined): number {
  return outlet?.taxEnabled ? toNumber(outlet.taxRate) : 0;
}

/** Preview of the bill. The server recalculates and is the source of truth. */
export function calcTotals(subtotal: number, taxRate: number) {
  const tax = roundMoney((subtotal * taxRate) / 100);
  return {
    subtotal: roundMoney(subtotal),
    tax,
    total: roundMoney(subtotal + tax),
  };
}

// ── Labels ──

export const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  dirty: "Cleaning",
};

export const KOT_STATUS_LABEL: Record<KotStatus, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  served: "Delivered",
  cancelled: "Cancelled",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  qr: "QR",
  yango: "Yango",
  foodmandu: "Foodmandu",
  pathao: "Pathao",
};

/** Delivery platforms: the amount entered is the platform price and becomes the order total. */
export const PLATFORM_METHODS: PaymentMethod[] = [
  "yango",
  "foodmandu",
  "pathao",
];

// ── Kitchen tickets ──

/** Tickets the floor still cares about (the API returns every ticket ever). */
export function isOpenTicket(ticket: KotTicket): boolean {
  return ticket.status !== "served" && ticket.status !== "cancelled";
}

/** Occupied table with a dine-in ticket ready to serve (web: checkTableReadyState). */
export function tableHasFoodReady(
  table: DiningTable,
  tickets: KotTicket[],
): boolean {
  if (table.status !== "occupied") return false;
  return tickets.some(
    (t) =>
      t.status === "ready" &&
      t.order.orderType === "dine_in" &&
      t.order.tableId === table.id,
  );
}

/** Takeaway tickets the kitchen has finished — the cashier's pickup queue. */
export function readyTakeaways(tickets: KotTicket[]): KotTicket[] {
  return tickets.filter(
    (t) => t.status === "ready" && t.order.orderType === "takeaway",
  );
}

export interface ItemKitchenState {
  kotItemId: string;
  ticketId: string;
  status: KotStatus;
}

/** orderItemId → its kitchen item, so the Order List can show and change item status. */
export function kitchenStateByOrderItem(
  tickets: KotTicket[],
): Map<string, ItemKitchenState> {
  const map = new Map<string, ItemKitchenState>();
  for (const ticket of tickets) {
    for (const item of ticket.items) {
      map.set(item.orderItem.id, {
        kotItemId: item.id,
        ticketId: ticket.id,
        status: item.status,
      });
    }
  }
  return map;
}

// ── Dates (history filter) ──

/** YYYY-MM-DD in the phone's local time, as the web history sends it. */
export function toDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── Payments ──

/** Product name + size, e.g. "Momo (Large)". */
export function orderItemName(item: {
  product?: { name: string } | null;
  variantLabel: string | null;
}): string {
  const base = item.product?.name ?? "Deleted product";
  return item.variantLabel ? `${base} (${item.variantLabel})` : base;
}

/**
 * Totals rounded exactly like the server (toFixed(2)), so an amount we send
 * for takeaway / per-item payment is never a paisa short.
 */
export function serverTotals(subtotal: number, taxRate: number) {
  const tax = parseFloat(((subtotal * taxRate) / 100).toFixed(2));
  return {
    subtotal: roundMoney(subtotal),
    tax,
    total: parseFloat((subtotal + tax).toFixed(2)),
  };
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "card",
  "qr",
  "yango",
  "foodmandu",
  "pathao",
];

/** Per-item payments on the web only offer these three. */
export const IN_PERSON_METHODS: PaymentMethod[] = ["cash", "card", "qr"];

export function isPlatformMethod(method: PaymentMethod): boolean {
  return PLATFORM_METHODS.includes(method);
}

export function parseAmount(text: string): number | null {
  const n = parseFloat(text.replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? roundMoney(n) : null;
}

export interface Tender {
  amount: number | null;
  change: number;
  error: string | null;
}

export function resolveTender(method: PaymentMethod, due: number, text: string): Tender {
  if (method === "cash") {
    const amount = parseAmount(text);
    if (amount === null) return { amount: null, change: 0, error: "Enter the amount received" };
    if (amount < due) return { amount, change: 0, error: `${formatRs(roundMoney(due - amount))} short` };
    return { amount, change: roundMoney(amount - due), error: null };
  }
  if (isPlatformMethod(method)) {
    if (!text.trim()) return { amount: due, change: 0, error: null };
    const amount = parseAmount(text);
    if (amount === null) return { amount: null, change: 0, error: "Enter a valid price" };
    if (amount < due) return { amount, change: 0, error: `Price can't be less than the bill (${formatRs(due)})` };
    return { amount, change: 0, error: null };
  }
  return { amount: due, change: 0, error: null };
}

/** Quick "amount received" buttons: exact, then the next 100 / 500 / 1000. */
export function quickCashAmounts(due: number): number[] {
  const exact = roundMoney(due);
  const rounded = [100, 500, 1000].map((step) => Math.ceil(exact / step) * step);
  return [...new Set([exact, ...rounded])].filter((a) => a >= exact).sort((a, b) => a - b).slice(0, 4);
}

export interface OrderDue {
  orderId: string;
  amount: number;
}

export function splitBill(dues: OrderDue[], method: PaymentMethod, tendered: number): OrderDue[] {
  const total = roundMoney(dues.reduce((sum, d) => sum + d.amount, 0));
  if (!isPlatformMethod(method) || tendered <= total || dues.length === 0) return dues;
  const extra = roundMoney(tendered - total);
  return dues.map((d, i) => (i === dues.length - 1 ? { ...d, amount: roundMoney(d.amount + extra) } : d));
}

