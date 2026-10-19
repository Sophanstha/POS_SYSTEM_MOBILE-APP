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
  stockItems: (outletId: string) => ["stockItems", outletId] as const,
  wastageMenuItems: (outletId: string) =>
    ["wastageMenuItems", outletId] as const,
  organization: (outletId: string) => ["organization", outletId] as const,
  managerDashboard: (outletId: string) =>
    ["managerDashboard", outletId] as const,
  salesTrend: (outletId: string, period: string) =>
    ["salesTrend", outletId, period] as const,
  paymentLedger: (outletId: string, date?: string, method?: string) =>
    ["paymentLedger", outletId, date ?? "", method ?? ""] as const,
  staff: (outletId: string) => ["staff", outletId] as const,
  productsAll: (outletId: string) => ["products", outletId] as const,
  menuItems: (outletId: string) => ["menuItems", outletId] as const,
  expenses: (
    outletId: string,
    categoryId?: string,
    startDate?: string,
    endDate?: string,
  ) =>
    [
      "expenses",
      outletId,
      categoryId ?? "",
      startDate ?? "",
      endDate ?? "",
    ] as const,
  expensesAll: (outletId: string) => ["expenses", outletId] as const,
  expenseCategories: (outletId: string) =>
    ["expenseCategories", outletId] as const,
  inventory: (outletId: string) => ["inventory", outletId] as const,
  stockCategories: (outletId: string) => ["stockCategories", outletId] as const,
  stockMovements: (outletId: string, stockItemId: string) =>
    ["stockMovements", outletId, stockItemId] as const,
  stockMovementsAll: (outletId: string) =>
    ["stockMovements", outletId] as const,
  recipeBook: (outletId: string) => ["recipeBook", outletId] as const,
  profitReport: (outletId: string, startMonth?: string, endMonth?: string) =>
    ["profitReport", outletId, startMonth ?? "", endMonth ?? ""] as const,
  orgOutlets: (organizationId: string) =>
    ["orgOutlets", organizationId] as const,
  orgReport: (organizationId: string, period: string, outletId: string) =>
    ["orgReport", organizationId, period, outletId] as const,
  branchSummaries: (organizationId: string, period: string, outletIds: string) =>
    ["branchSummaries", organizationId, period, outletIds] as const,
  trialStatus: (organizationId: string) => ["trialStatus", organizationId] as const,
  orgRoles: (organizationId: string) => ["orgRoles", organizationId] as const,
  rolePermissions: (organizationId: string, roleId: string, outletId: string) =>
    ["rolePermissions", organizationId, roleId, outletId] as const,
  staffAllOutlets: (organizationId: string) => ["staffAllOutlets", organizationId] as const,
  profitReportAll: (organizationId: string, startMonth?: string, endMonth?: string) =>
    ["profitReportAll", organizationId, startMonth ?? "", endMonth ?? ""] as const,
};

/** How often live screens poll — same as the web POS. */
export const POLL_MS = 5000;
