/**
 * One place for every TanStack Query key. Keys start with the outlet id so
 * data from one outlet is never shown for another.
 */
export const queryKeys = {
  tables: (outletId: string) => ["tables", outletId] as const,
  kot: (outletId: string) => ["kot", outletId] as const,
  tableOrders: (outletId: string, tableId: string) =>
    ["tableOrders", outletId, tableId] as const,
  tableOrdersAll: (outletId: string) => ["tableOrders", outletId] as const,
  categories: (outletId: string) => ["categories", outletId] as const,
  products: (outletId: string, categoryId: string | null) =>
    ["products", outletId, categoryId ?? "all"] as const,
  variants: (outletId: string, productId: string) =>
    ["variants", outletId, productId] as const,
  variantsAll: (outletId: string) => ["variants", outletId] as const,
  outlet: (outletId: string) => ["outlet", outletId] as const,
  history: (outletId: string, startDate?: string, endDate?: string) =>
    ["history", outletId, startDate ?? "", endDate ?? ""] as const,
  historyAll: (outletId: string) => ["history", outletId] as const,
  paymentStatus: (outletId: string, orderId: string) =>
    ["paymentStatus", outletId, orderId] as const,
  paymentStatusAll: (outletId: string) => ["paymentStatus", outletId] as const,
  orderPayments: (outletId: string, orderId: string) =>
    ["orderPayments", outletId, orderId] as const,
  orderPaymentsAll: (outletId: string) => ["orderPayments", outletId] as const,
};

/** How often live screens poll — same as the web POS. */
export const POLL_MS = 5000;
