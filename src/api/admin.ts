import { api } from "./client";
import type { AccountForm, Expense, ExpenseCategory, ExpenseFilters, ExpenseForm, ExpenseList, ExpenseStats, InventoryItem, InventoryItemForm, LedgerPayment, ManagerDashboard, MenuItem, Organization, OutletForm, PaymentFilters, ProfitRange, ProfitReport, RecipeIngredient, RecipeRow, SalesTrendPoint, StaffForm, StaffMember, StockCategory, StockChange, StockMovement, TableForm, TrendPeriod } from "../types/admin";
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
export async function getSalesTrend(period: TrendPeriod): Promise<SalesTrendPoint[]> {
  const { data } = await api.get<{ salesTrend: SalesTrendPoint[] }>("/reports/sales-trend", { params: { period } });
  return data.salesTrend ?? [];
}

const PAYMENT_PAGE_SIZE = 100; // server maximum

/** Every payment matching the filters (all pages, like the web ledger), newest first. */
export async function getPaymentLedger(filters: PaymentFilters): Promise<LedgerPayment[]> {
  const all: LedgerPayment[] = [];
  for (let page = 1; ; page++) {
    const { data } = await api.get<{ payments: LedgerPayment[]; pagination?: { totalPages: number } }>("/payment", {
      params: { page, limit: PAYMENT_PAGE_SIZE, ...filters },
    });
    all.push(...(data.payments ?? []));
    if (page >= (data.pagination?.totalPages ?? 1)) return all;
  }
}



// ── Staff ──

const STAFF_PAGE_SIZE = 100; // server maximum

/** Every staff member of the outlet (all pages, so search and totals cover everyone). */
export async function getStaff(): Promise<StaffMember[]> {
  const all: StaffMember[] = [];
  for (let page = 1; ; page++) {
    const { data } = await api.get<{ staff: StaffMember[]; pagination?: { totalPages: number } }>("/staff", {
      params: { page, limit: STAFF_PAGE_SIZE },
    });
    all.push(...(data.staff ?? []));
    if (page >= (data.pagination?.totalPages ?? 1)) return all;
  }
}

export async function createStaff(form: StaffForm): Promise<void> {
  await api.post("/staff", {
    name: form.name,
    email: form.email,
    phone: form.phone || undefined,
    role: form.role,
    password: form.password,
  });
}

/** Name, email and phone (an empty phone is left as it was, like the web). */
export async function updateStaffInfo(userId: string, form: Pick<StaffForm, "name" | "email" | "phone">): Promise<void> {
  await api.patch(`/staff/${userId}/info`, { name: form.name, email: form.email, phone: form.phone || undefined });
}

export async function updateStaffRole(userId: string, role: string): Promise<void> {
  await api.patch(`/staff/${userId}`, { role });
}

export async function setStaffActive(userId: string, isActive: boolean): Promise<void> {
  await api.patch(`/staff/${userId}/status`, { isActive });
}

export async function removeStaff(userId: string): Promise<void> {
  await api.delete(`/staff/${userId}`);
}


// ── Tables ──

type TableFields = Omit<TableForm, "status">;

/** New table (status starts as "available"); returns its id. */
export async function createTable(fields: TableFields): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>("/tables", fields);
  return data;
}

export async function updateTable(tableId: string, fields: TableFields): Promise<void> {
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
      const variants = await getVariants(p.id).catch((): ProductVariant[] => []);
      return {
        ...p,
        sizes: variants.map((v) => ({ id: v.id, label: v.label, price: toNumber(v.price), isAvailable: v.isAvailable !== false })),
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
export async function createProduct(fields: ProductFields): Promise<string | null> {
  const { data } = await api.post<string | { id?: string; product?: { id: string } }>("/product", fields);
  return typeof data === "string" ? data : (data?.product?.id ?? data?.id ?? null);
}

export async function updateProduct(productId: string, fields: ProductFields): Promise<void> {
  await api.patch(`/product/${productId}`, fields);
}

export async function deleteProduct(productId: string): Promise<void> {
  await api.delete(`/product/${productId}`);
}

type SizeFields = { label: string; price: number };

export async function createSize(productId: string, size: SizeFields): Promise<void> {
  await api.post(`/product/${productId}/variants`, { label: size.label, price: size.price.toFixed(2) });
}

export async function updateSize(productId: string, sizeId: string, size: SizeFields): Promise<void> {
  await api.patch(`/product/${productId}/variants/${sizeId}`, { label: size.label, price: size.price.toFixed(2) });
}

export async function deleteSize(productId: string, sizeId: string): Promise<void> {
  await api.delete(`/product/${productId}/variants/${sizeId}`);
}

export async function createCategory(name: string): Promise<void> {
  await api.post("/categories", { name });
}

export async function renameCategory(categoryId: string, name: string): Promise<void> {
  await api.patch(`/categories/${categoryId}`, { name });
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await api.delete(`/categories/${categoryId}`);
}



// ── Expenses ──

/** Newest 20 expenses matching the filters, and totals over all of them. */
export async function getExpenses(filters: ExpenseFilters): Promise<ExpenseList> {
  const { data } = await api.get<{ expenses?: Expense[]; stats?: Partial<ExpenseStats> }>("/expenses", { params: filters });
  return {
    expenses: (data.expenses ?? []).map((e) => ({ ...e, amount: Number(e.amount ?? 0) })),
    stats: {
      totalExpenses: Number(data.stats?.totalExpenses ?? 0),
      totalSpend: Number(data.stats?.totalSpend ?? 0),
      fromInventory: Number(data.stats?.fromInventory ?? 0),
      manualCount: Number(data.stats?.manualCount ?? 0),
    },
  };
}

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const { data } = await api.get<{ categories?: ExpenseCategory[] }>("/expenses/category");
  return data.categories ?? [];
}

export async function createExpenseCategory(name: string): Promise<ExpenseCategory | null> {
  const { data } = await api.post<{ category?: ExpenseCategory }>("/expenses/category", { name });
  return data.category ?? null;
}

export async function createExpense(form: ExpenseForm): Promise<void> {
  await api.post("/expenses", { ...form, note: form.note || undefined });
}

/** An empty note clears it. */
export async function updateExpense(expenseId: string, form: ExpenseForm): Promise<void> {
  await api.patch(`/expenses/${expenseId}`, form);
}

export async function deleteExpense(expenseId: string): Promise<void> {
  await api.delete(`/expenses/${expenseId}`);
}


// ── Inventory ──

/** Every raw ingredient of the outlet (sorted by name). */
export async function getInventory(): Promise<InventoryItem[]> {
  const { data } = await api.get<{ stockItems?: InventoryItem[] }>("/inventory");
  return data.stockItems ?? [];
}

export async function getStockCategories(): Promise<StockCategory[]> {
  const { data } = await api.get<{ categories?: StockCategory[] }>("/stockCategory");
  return data.categories ?? [];
}

export async function createStockCategory(name: string): Promise<StockCategory | null> {
  const { data } = await api.post<{ category?: StockCategory }>("/stockCategory", { name });
  return data.category ?? null;
}

/** New ingredient, starting at 0 in stock (add stock with a purchase, like the web). */
export async function createInventoryItem(form: InventoryItemForm): Promise<void> {
  await api.post("/inventory", { ...form, currentStock: 0 });
}

/** Name, category and warning level (the unit stays). */
export async function updateInventoryItem(stockItemId: string, form: InventoryItemForm): Promise<void> {
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
export async function changeStock(stockItemId: string, change: StockChange): Promise<void> {
  if (change.kind === "purchase") {
    await api.post(`/inventory/${stockItemId}/purchase`, {
      quantity: change.quantity,
      note: change.note || undefined,
      totalCost: change.totalCost,
      expenseNote: change.expenseNote || undefined,
    });
    return;
  }
  await api.post(`/inventory/${stockItemId}/adjustment`, { newQuantity: change.newQuantity, note: change.note || undefined });
}

const MOVEMENT_PAGE_SIZE = 30;

/** Latest stock changes of one ingredient, newest first. */
export async function getStockMovements(stockItemId: string): Promise<StockMovement[]> {
  const { data } = await api.get<{ movements?: StockMovement[] }>(`/inventory/${stockItemId}/movement`, {
    params: { limit: MOVEMENT_PAGE_SIZE },
  });
  return data.movements ?? [];
}


// ── Recipes ──

/** Ingredients of a dish (or one size of it); null when it has no recipe. */
export async function getRecipe(productId: string, variantId: string | null): Promise<RecipeItem[] | null> {
  try {
    const { data } = await api.get<{ recipe: { items: RecipeItem[] } | null }>(`/recipe/${productId}`, {
      params: variantId ? { variantId } : undefined,
    });
    return data.recipe ? data.recipe.items.map((i) => ({ ...i, quantity: Number(i.quantity) })) : null;
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
      ? p.sizes.map((s) => ({ key: `${p.id}-${s.id}`, productId: p.id, variantId: s.id, name: `${p.name} (${s.label})`, price: s.price }))
      : [{ key: p.id, productId: p.id, variantId: null, name: p.name, price: p.price }],
  );
  return Promise.all(rows.map(async (row) => ({ ...row, items: await getRecipe(row.productId, row.variantId) })));
}

/** Creates the recipe, or replaces its ingredients when it already has one. */
export async function saveRecipe(row: RecipeRow, ingredients: RecipeIngredient[]): Promise<void> {
  const params = row.variantId ? { variantId: row.variantId } : undefined;
  const body = { items: ingredients, ...(row.variantId ? { variantId: row.variantId } : {}) };
  if (row.items) await api.patch(`/recipe/${row.productId}`, body, { params });
  else await api.post(`/recipe/${row.productId}`, body, { params });
}

export async function deleteRecipe(row: RecipeRow): Promise<void> {
  await api.delete(`/recipe/${row.productId}`, { params: row.variantId ? { variantId: row.variantId } : undefined });
}


// ── Analytics ──

/** Revenue, expenses and profit per month / year for the chosen month range. */
export async function getProfitReport(range: ProfitRange): Promise<ProfitReport> {
  const { data } = await api.get<ProfitReport>("/reports/profit", { params: range });
  return { overall: data.overall, years: data.years ?? [], months: data.months ?? [] };
}


// ── Settings ──

/** Saves your own name / email (and password when both are given); returns what was saved. */
export async function updateAccount(form: AccountForm): Promise<{ name: string; email: string }> {
  const { data } = await api.patch<{ user: { name: string; email: string } }>("/auth/change-userDetail", {
    name: form.name,
    email: form.email,
    ...(form.currentPassword && form.newPassword ? { currentPassword: form.currentPassword, newPassword: form.newPassword } : {}),
  });
  return data.user;
}

/** Outlet name, address, phone and tax (the tax shows on every new bill). */
export async function updateOutletSettings(outletId: string, form: OutletForm): Promise<void> {
  await api.patch(`/outlets/${outletId}`, {
    name: form.name,
    address: form.address,
    phone: form.phone,
    taxEnabled: form.taxEnabled,
    taxRate: Number(form.taxRate || 0).toFixed(2),
    taxName: form.taxName || undefined,
  });
}
