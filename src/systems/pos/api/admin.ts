import { api } from "../../../shared/api/client";
import type {
  AccountForm,
  Expense,
  ExpenseCategory,
  ExpenseFilters,
  ExpenseForm,
  ExpenseList,
  ExpenseStats,
  InventoryItem,
  InventoryItemForm,
  LedgerPayment,
  ManagerDashboard,
  MenuItem,
  Organization,
  OrgOutlet,
  BranchSummary,
  OrgOutletForm,
  OrgPeriod,
  OrgReport,
  OrgRole,
  PermissionsByModule,
  ProfitTotals,
  TrialStatus,
  OutletForm,
  PaymentFilters,
  ProfitRange,
  ProfitReport,
  RecipeIngredient,
  RecipeRow,
  SalesTrendPoint,
  StaffForm,
  StaffMember,
  StockCategory,
  StockChange,
  StockMovement,
  TableForm,
  TrendPeriod,
  LowStockAlert,
} from "../types/admin";
import { getProducts, getVariants } from "./pos";
import { ProductVariant, RecipeItem } from "../types/pos";
import { toNumber } from "../lib/pos";

/** Organisation name and logo (needs core.outlets.read — Manager and Owner have it). */
export async function getOrganization(): Promise<Organization> {
  const { data } = await api.get<Organization>("/org/tenant");
  return data;
}

/** Revenue, popular items, active staff and low-stock alerts of the active outlet. */
export async function getManagerDashboard(): Promise<ManagerDashboard> {
  const { data } = await api.get<ManagerDashboard>("/dashboard/manager");
  return data;
}

/**
 * Sales per hour / day / week. Separate call like the web: /dashboard/manager
 * always answers with the hourly trend.
 */
export async function getSalesTrend(
  period: TrendPeriod,
): Promise<SalesTrendPoint[]> {
  const { data } = await api.get<{ salesTrend: SalesTrendPoint[] }>(
    "/reports/sales-trend",
    { params: { period } },
  );
  return data.salesTrend ?? [];
}

const PAYMENT_PAGE_SIZE = 100; // server maximum

/** Every payment matching the filters (all pages, like the web ledger), newest first. */
export async function getPaymentLedger(
  filters: PaymentFilters,
): Promise<LedgerPayment[]> {
  const all: LedgerPayment[] = [];
  for (let page = 1; ; page++) {
    const { data } = await api.get<{
      payments: LedgerPayment[];
      pagination?: { totalPages: number };
    }>("/payment", {
      params: { page, limit: PAYMENT_PAGE_SIZE, ...filters },
    });
    all.push(...(data.payments ?? []));
    if (page >= (data.pagination?.totalPages ?? 1)) return all;
  }
}

// ── Staff ──

const STAFF_PAGE_SIZE = 100; // server maximum

/** Every staff member of the outlet (all pages, so search and totals cover everyone). */
export async function getStaff(outletId?: string): Promise<StaffMember[]> {
  const all: StaffMember[] = [];
  for (let page = 1; ; page++) {
    const { data } = await api.get<{
      staff: StaffMember[];
      pagination?: { totalPages: number };
    }>("/staff", {
      params: { page, limit: STAFF_PAGE_SIZE, outletId },
    });
    all.push(...(data.staff ?? []));
    if (page >= (data.pagination?.totalPages ?? 1)) return all;
  }
}

/** The Owner must say which outlet; for a Manager the server uses the login's outlet. */
export async function createStaff(
  form: StaffForm,
  outletId?: string | null,
): Promise<void> {
  await api.post("/staff", {
    name: form.name,
    email: form.email,
    phone: form.phone || undefined,
    role: form.role,
    password: form.password,
    outletId: outletId ?? undefined,
  });
}

/** Name, email and phone (an empty phone is left as it was, like the web). */
export async function updateStaffInfo(
  userId: string,
  form: Pick<StaffForm, "name" | "email" | "phone">,
  outletId?: string | null,
): Promise<void> {
  await api.patch(`/staff/${userId}/info`, {
    name: form.name,
    email: form.email,
    phone: form.phone || undefined,
    outletId: outletId ?? undefined,
  });
}

export async function updateStaffRole(
  userId: string,
  role: string,
  outletId?: string | null,
): Promise<void> {
  await api.patch(`/staff/${userId}`, { role, outletId: outletId ?? undefined });
}

export async function setStaffActive(
  userId: string,
  isActive: boolean,
  outletId?: string | null,
): Promise<void> {
  await api.patch(`/staff/${userId}/status`, { isActive, outletId: outletId ?? undefined });
}

export async function removeStaff(userId: string, outletId?: string | null): Promise<void> {
  await api.delete(`/staff/${userId}`, { params: outletId ? { outletId } : undefined });
}

// ── Tables ──

type TableFields = Omit<TableForm, "status">;

/** New table (status starts as "available"); returns its id. */
export async function createTable(
  fields: TableFields,
): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>("/tables", fields);
  return data;
}

export async function updateTable(
  tableId: string,
  fields: TableFields,
): Promise<void> {
  await api.patch(`/tables/${tableId}`, fields);
}

export async function deleteTable(tableId: string): Promise<void> {
  await api.delete(`/tables/${tableId}`);
}

// ── Menu ──

/** Every menu item with its sizes (one sizes call per item, like the web). */
export async function getMenuItems(): Promise<MenuItem[]> {
  const products = await getProducts();
  return Promise.all(
    products.map(async (p) => {
      const variants = await getVariants(p.id).catch(
        (): ProductVariant[] => [],
      );
      return {
        ...p,
        sizes: variants.map((v) => ({
          id: v.id,
          label: v.label,
          price: toNumber(v.price),
          isAvailable: v.isAvailable !== false,
        })),
      };
    }),
  );
}

type ProductFields = {
  name: string;
  categoryId: string;
  price: number;
  description?: string;
  /** Cloudinary key of the photo; "" removes the photo. */
  imagePublicId?: string;
};

/** New menu item; returns its id (the server answers with the bare id). */
export async function createProduct(
  fields: ProductFields,
): Promise<string | null> {
  const { data } = await api.post<
    string | { id?: string; product?: { id: string } }
  >("/product", fields);
  return typeof data === "string"
    ? data
    : (data?.product?.id ?? data?.id ?? null);
}

export async function updateProduct(
  productId: string,
  fields: ProductFields,
): Promise<void> {
  await api.patch(`/product/${productId}`, fields);
}

export async function deleteProduct(productId: string): Promise<void> {
  await api.delete(`/product/${productId}`);
}

type SizeFields = { label: string; price: number };

export async function createSize(
  productId: string,
  size: SizeFields,
): Promise<void> {
  await api.post(`/product/${productId}/variants`, {
    label: size.label,
    price: size.price.toFixed(2),
  });
}

export async function updateSize(
  productId: string,
  sizeId: string,
  size: SizeFields,
): Promise<void> {
  await api.patch(`/product/${productId}/variants/${sizeId}`, {
    label: size.label,
    price: size.price.toFixed(2),
  });
}

export async function deleteSize(
  productId: string,
  sizeId: string,
): Promise<void> {
  await api.delete(`/product/${productId}/variants/${sizeId}`);
}

export async function createCategory(name: string): Promise<void> {
  await api.post("/categories", { name });
}

export async function renameCategory(
  categoryId: string,
  name: string,
): Promise<void> {
  await api.patch(`/categories/${categoryId}`, { name });
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await api.delete(`/categories/${categoryId}`);
}

// ── Expenses ──

/** Newest 20 expenses matching the filters, and totals over all of them. */
export async function getExpenses(
  filters: ExpenseFilters,
): Promise<ExpenseList> {
  const { data } = await api.get<{
    expenses?: Expense[];
    stats?: Partial<ExpenseStats>;
  }>("/expenses", { params: filters });
  return {
    expenses: (data.expenses ?? []).map((e) => ({
      ...e,
      amount: Number(e.amount ?? 0),
    })),
    stats: {
      totalExpenses: Number(data.stats?.totalExpenses ?? 0),
      totalSpend: Number(data.stats?.totalSpend ?? 0),
      fromInventory: Number(data.stats?.fromInventory ?? 0),
      manualCount: Number(data.stats?.manualCount ?? 0),
    },
  };
}

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const { data } = await api.get<{ categories?: ExpenseCategory[] }>(
    "/expenses/category",
  );
  return data.categories ?? [];
}

export async function createExpenseCategory(
  name: string,
): Promise<ExpenseCategory | null> {
  const { data } = await api.post<{ category?: ExpenseCategory }>(
    "/expenses/category",
    { name },
  );
  return data.category ?? null;
}

export async function createExpense(form: ExpenseForm): Promise<void> {
  await api.post("/expenses", { ...form, note: form.note || undefined });
}

/** An empty note clears it. */
export async function updateExpense(
  expenseId: string,
  form: ExpenseForm,
): Promise<void> {
  await api.patch(`/expenses/${expenseId}`, form);
}

export async function deleteExpense(expenseId: string): Promise<void> {
  await api.delete(`/expenses/${expenseId}`);
}

// ── Inventory ──

/** Every raw ingredient of the outlet (sorted by name). */
export async function getInventory(): Promise<InventoryItem[]> {
  const { data } = await api.get<{ stockItems?: InventoryItem[] }>(
    "/inventory",
  );
  return data.stockItems ?? [];
}

export async function getStockCategories(): Promise<StockCategory[]> {
  const { data } = await api.get<{ categories?: StockCategory[] }>(
    "/stockCategory",
  );
  return data.categories ?? [];
}

export async function createStockCategory(
  name: string,
): Promise<StockCategory | null> {
  const { data } = await api.post<{ category?: StockCategory }>(
    "/stockCategory",
    { name },
  );
  return data.category ?? null;
}

/** New ingredient, starting at 0 in stock (add stock with a purchase, like the web). */
export async function createInventoryItem(
  form: InventoryItemForm,
): Promise<void> {
  await api.post("/inventory", { ...form, currentStock: 0 });
}

/** Name, category and warning level (the unit stays). */
export async function updateInventoryItem(
  stockItemId: string,
  form: InventoryItemForm,
): Promise<void> {
  await api.patch(`/inventory/${stockItemId}`, {
    name: form.name,
    minStockLevel: form.minStockLevel,
    categoryId: form.categoryId || undefined,
  });
}

export async function deleteInventoryItem(stockItemId: string): Promise<void> {
  await api.delete(`/inventory/${stockItemId}`);
}

/** Restock (adds on top, can log an expense) or set the counted amount. */
export async function changeStock(
  stockItemId: string,
  change: StockChange,
): Promise<void> {
  if (change.kind === "purchase") {
    await api.post(`/inventory/${stockItemId}/purchase`, {
      quantity: change.quantity,
      note: change.note || undefined,
      totalCost: change.totalCost,
      expenseNote: change.expenseNote || undefined,
    });
    return;
  }
  await api.post(`/inventory/${stockItemId}/adjustment`, {
    newQuantity: change.newQuantity,
    note: change.note || undefined,
  });
}

const MOVEMENT_PAGE_SIZE = 30;

/** Latest stock changes of one ingredient, newest first. */
export async function getStockMovements(
  stockItemId: string,
): Promise<StockMovement[]> {
  const { data } = await api.get<{ movements?: StockMovement[] }>(
    `/inventory/${stockItemId}/movement`,
    {
      params: { limit: MOVEMENT_PAGE_SIZE },
    },
  );
  return data.movements ?? [];
}

// ── Recipes ──

/** Ingredients of a dish (or one size of it); null when it has no recipe. */
export async function getRecipe(
  productId: string,
  variantId: string | null,
): Promise<RecipeItem[] | null> {
  try {
    const { data } = await api.get<{ recipe: { items: RecipeItem[] } | null }>(
      `/recipe/${productId}`,
      {
        params: variantId ? { variantId } : undefined,
      },
    );
    return data.recipe
      ? data.recipe.items.map((i) => ({ ...i, quantity: Number(i.quantity) }))
      : null;
  } catch {
    // Same as the web: a recipe that can't be read counts as "none yet".
    return null;
  }
}

/** Every menu item — one line per size — with its recipe. */
export async function getRecipeBook(): Promise<RecipeRow[]> {
  const items = await getMenuItems();
  const rows = items.flatMap((p): Omit<RecipeRow, "items">[] =>
    p.sizes.length > 0
      ? p.sizes.map((s) => ({
          key: `${p.id}-${s.id}`,
          productId: p.id,
          variantId: s.id,
          name: `${p.name} (${s.label})`,
          price: s.price,
        }))
      : [
          {
            key: p.id,
            productId: p.id,
            variantId: null,
            name: p.name,
            price: p.price,
          },
        ],
  );
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      items: await getRecipe(row.productId, row.variantId),
    })),
  );
}

/** Creates the recipe, or replaces its ingredients when it already has one. */
export async function saveRecipe(
  row: RecipeRow,
  ingredients: RecipeIngredient[],
): Promise<void> {
  const params = row.variantId ? { variantId: row.variantId } : undefined;
  const body = {
    items: ingredients,
    ...(row.variantId ? { variantId: row.variantId } : {}),
  };
  if (row.items) await api.patch(`/recipe/${row.productId}`, body, { params });
  else await api.post(`/recipe/${row.productId}`, body, { params });
}

export async function deleteRecipe(row: RecipeRow): Promise<void> {
  await api.delete(`/recipe/${row.productId}`, {
    params: row.variantId ? { variantId: row.variantId } : undefined,
  });
}

// ── Analytics ──

/** Revenue, expenses and profit per month / year for the chosen month range. */
export async function getProfitReport(
  range: ProfitRange,
  outletId?: string,
): Promise<ProfitReport> {
  const { data } = await api.get<ProfitReport>("/reports/profit", {
    params: { ...range, outletId },
  });
  return {
    overall: data.overall,
    years: data.years ?? [],
    months: data.months ?? [],
  };
}

// ── Settings ──

/** Saves your own name / email (and password when both are given); returns what was saved. */
export async function updateAccount(
  form: AccountForm,
): Promise<{ name: string; email: string }> {
  const { data } = await api.patch<{ user: { name: string; email: string } }>(
    "/auth/change-userDetail",
    {
      name: form.name,
      email: form.email,
      ...(form.currentPassword && form.newPassword
        ? {
            currentPassword: form.currentPassword,
            newPassword: form.newPassword,
          }
        : {}),
    },
  );
  return data.user;
}

/** Outlet name, address, phone and tax (the tax shows on every new bill). */
export async function updateOutletSettings(
  outletId: string,
  form: OutletForm,
): Promise<void> {
  await api.patch(`/outlets/${outletId}`, {
    name: form.name,
    address: form.address,
    phone: form.phone,
    taxEnabled: form.taxEnabled,
    taxRate: Number(form.taxRate || 0).toFixed(2),
    taxName: form.taxName || undefined,
  });
}

// ── Owner ──

/** Every outlet of the organisation, oldest first. */
export async function getOrgOutlets(): Promise<OrgOutlet[]> {
  const { data } = await api.get<{ outlets?: OrgOutlet[] }>("/outlets");
  return [...(data.outlets ?? [])].sort((a, b) =>
    String(a.createdAt).localeCompare(String(b.createdAt)),
  );
}


// ── Owner: overview ──

/** Organisation report: totals, sales trend, payments, popular items, staff ranking. No outlet = all outlets. */
export async function getOrgReport(period: OrgPeriod, outletId?: string | null): Promise<OrgReport> {
  const { data } = await api.get<Partial<OrgReport>>("/org/dashboardData", {
    params: { period, ...(outletId ? { outletId } : {}) },
  });
  return {
    summary: {
      totalRevenue: Number(data.summary?.totalRevenue ?? 0),
      totalOrders: Number(data.summary?.totalOrders ?? 0),
      avgOrderValue: Number(data.summary?.avgOrderValue ?? 0),
      activeStaff: Number(data.summary?.activeStaff ?? 0),
    },
    salesTrend: (data.salesTrend ?? []).map((t) => ({ label: t.label, total: Number(t.total ?? 0), count: Number(t.count ?? 0) })),
    paymentShare: {
      netSettledAmount: Number(data.paymentShare?.netSettledAmount ?? 0),
      breakdown: data.paymentShare?.breakdown ?? {},
    },
    popularItems: data.popularItems ?? [],
    leaderboard: data.leaderboard ?? [],
  };
}

/** Revenue and orders of each outlet for the branch comparison (one call per outlet, like the web). */
export async function getBranchSummaries(period: OrgPeriod, outlets: OrgOutlet[]): Promise<BranchSummary[]> {
  const results = await Promise.allSettled(
    outlets.map((o) =>
      getOrgReport(period, o.id).then((r) => ({
        outletId: o.id,
        name: o.name,
        revenue: r.summary.totalRevenue,
        orders: r.summary.totalOrders,
      })),
    ),
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
}

/** Free trial / subscription state of the organisation. */
export async function getTrialStatus(): Promise<TrialStatus> {
  const { data } = await api.get<TrialStatus>("/superadmin/organizations/trial-status");
  return data;
}


// ── Owner: outlets ──

export async function createOrgOutlet(form: OrgOutletForm): Promise<void> {
  await api.post("/outlets", { name: form.name, phone: form.phone, address: form.address });
}

export async function updateOrgOutlet(outletId: string, form: OrgOutletForm): Promise<void> {
  await api.patch(`/outlets/${outletId}`, { name: form.name, phone: form.phone, address: form.address });
}

export async function setOrgOutletActive(outletId: string, isActive: boolean): Promise<void> {
  await api.patch(`/outlets/${outletId}/status`, { isActive });
}

/** true = orders skip the kitchen screen (served straight away). */
export async function setKitchenWorkflow(outletId: string, skipKitchen: boolean): Promise<void> {
  await api.patch(`/outlets/${outletId}`, { skipKitchenWorkflow: skipKitchen });
}

/** The server refuses the last outlet, or one that still has orders / staff. */
export async function deleteOrgOutlet(outletId: string): Promise<void> {
  await api.delete(`/outlets/${outletId}`);
}


// ── Owner: roles ──

export async function getOrgRoles(): Promise<OrgRole[]> {
  const { data } = await api.get<{ roles?: OrgRole[] }>("/org/role");
  return data.roles ?? [];
}

/** What a role may do at an outlet (outlet setting > organisation setting > default). */
export async function getRolePermissions(roleId: string, outletId?: string | null): Promise<PermissionsByModule> {
  const { data } = await api.get<{ permissions?: PermissionsByModule }>("/permission", {
    params: { roleId, ...(outletId ? { outletId } : {}) },
  });
  return data.permissions ?? {};
}


// ── Owner: organisation ──

export async function updateOrganization(fields: { name: string; imagePublicId?: string }): Promise<void> {
  await api.patch("/org/tenant", fields);
}

export async function removeOrganizationLogo(): Promise<void> {
  await api.delete("/org/tenant/image");
}


// ── Owner: all outlets ──

/** Staff of every outlet, each with the outlet they work at. */
export async function getStaffAllOutlets(outlets: OrgOutlet[]): Promise<StaffMember[]> {
  const lists = await Promise.all(
    outlets.map(async (o) => (await getStaff(o.id)).map((s) => ({ ...s, outletId: o.id, outletName: o.name }))),
  );
  return lists.flat();
}

const NO_MONEY: ProfitTotals = { revenue: 0, purchaseExpense: 0, wastageExpense: 0, manualExpense: 0, grossProfit: 0, netProfit: 0 };

const addTotals = (a: ProfitTotals, b: ProfitTotals): ProfitTotals => ({
  revenue: a.revenue + b.revenue,
  purchaseExpense: a.purchaseExpense + b.purchaseExpense,
  wastageExpense: a.wastageExpense + b.wastageExpense,
  manualExpense: a.manualExpense + b.manualExpense,
  grossProfit: a.grossProfit + b.grossProfit,
  netProfit: a.netProfit + b.netProfit,
});

const roundTotals = (t: ProfitTotals): ProfitTotals => ({
  revenue: Number(t.revenue.toFixed(2)),
  purchaseExpense: Number(t.purchaseExpense.toFixed(2)),
  wastageExpense: Number(t.wastageExpense.toFixed(2)),
  manualExpense: Number(t.manualExpense.toFixed(2)),
  grossProfit: Number(t.grossProfit.toFixed(2)),
  netProfit: Number(t.netProfit.toFixed(2)),
});

/**
 * Profit report of all your outlets together: each outlet's report added up.
 * (The server's own "all" isn't limited to your organisation, so it isn't used.)
 */
export async function getProfitReportAllOutlets(range: ProfitRange, outletIds: string[]): Promise<ProfitReport> {
  const reports = await Promise.all(outletIds.map((id) => getProfitReport(range, id)));
  const months = new Map<string, ProfitTotals>();
  const years = new Map<string, ProfitTotals>();
  for (const r of reports) {
    for (const m of r.months) months.set(m.month, addTotals(months.get(m.month) ?? NO_MONEY, m));
    for (const y of r.years) years.set(y.year, addTotals(years.get(y.year) ?? NO_MONEY, y));
  }
  return {
    overall: roundTotals(reports.reduce((sum, r) => addTotals(sum, r.overall), NO_MONEY)),
    years: [...years.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([year, t]) => ({ year, ...roundTotals(t) })),
    months: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, t]) => ({ month, ...roundTotals(t) })),
  };
}

/** Ingredients at or below their alert level (same list as the web's stock alerts). */
export async function getStockAlerts(): Promise<LowStockAlert[]> {
  const { data } = await api.get<{ alerts?: LowStockAlert[] }>("/alert");
  return data.alerts ?? [];
}
