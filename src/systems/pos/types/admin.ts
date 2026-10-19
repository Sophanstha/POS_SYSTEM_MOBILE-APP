import { PaymentMethod, Product, RecipeItem, StockItem, TableShape, TableStatus } from "./pos";

/** GET /org/tenant — the organisation shown at the top of the Manager / Owner menu. */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

// ── Manager dashboard ──

/** 24H = today by hour, 7D = last 7 days, 30D = last 4 weeks. */
export type TrendPeriod = "hourly" | "weekly" | "monthly";

/** One bar of the sales trend ("14:00", "Monday", "Week 2"). */
export interface SalesTrendPoint {
  label: string;
  total: number;
  count: number;
}

export interface TopProduct {
  rank: number;
  name: string;
  totalSold: number;
  totalRevenue: number;
}

/** Stock item at or below its minimum level. */
export interface LowStockAlert {
  id: string;
  name: string;
  currentStock: number;
  minStockLevel: number;
  unit: string;
  isOutOfStock: boolean;
}

/** GET /dashboard/manager */
export interface ManagerDashboard {
  totalRevenue: number;
  topProducts: TopProduct[];
  salesTrend: SalesTrendPoint[];
  activeStaff: number;
  lowstock?: LowStockAlert[];
}

// ── Payments ledger ──

/** GET /payment — one payment row. */
export interface LedgerPayment {
  id: string;
  orderId: string;
  orderNumber: number;
  orderType: "dine_in" | "takeaway";
  tableNumber: string | null;
  method: PaymentMethod;
  amount: number;
  createdAt: string;
  /** Nepal time, "2026-04-17 14:30:25". */
  createdAtNepal: string;
}

export interface PaymentFilters {
  /** "2026-10-11" — one day (Nepal time). */
  date?: string;
  method?: PaymentMethod;
}

// ── Staff ──

/** GET /staff — one person working at the outlet (managers don't see other managers). */
export interface StaffMember {
  /** Owner "All outlets": the outlet this person works at. */
  outletId?: string;
  outletName?: string;
  userId: string;
  name: string;
  role: string;
  email: string;
  phone: string | null;
  isActive: boolean;
}

/** Add / edit staff dialog. `password` is only used when adding. */
export interface StaffForm {
  name: string;
  role: string;
  email: string;
  phone: string;
  password: string;
}

// ── Tables ──

/** Add / edit table dialog. */
export interface TableForm {
  tableNumber: string;
  capacity: number;
  shape: TableShape;
  status: TableStatus;
}



// ── Menu ──

/** One size of a menu item ("Small", "500ML"). */
export interface MenuSize {
  id: string;
  label: string;
  price: number;
  /** False when the recipe's stock has run out (worked out by the server). */
  isAvailable: boolean;
}

/** A product with its sizes (empty when it has one price). */
export interface MenuItem extends Product {
  sizes: MenuSize[];
}

/** Photo chosen with the image picker, not uploaded yet. */
export interface PickedImage {
  uri: string;
  mimeType?: string;
  fileName?: string | null;
}

/** Add / edit menu item dialog, checked and ready to save. */
export interface MenuItemForm {
  name: string;
  categoryId: string;
  /** The price, or the cheapest size when the item has sizes (like the web). */
  price: number;
  description: string;
  /** null = one price; otherwise every size to keep (no id = new size). */
  sizes: { id?: string; label: string; price: number }[] | null;
  /** New photo to upload; null keeps the current one. */
  image: PickedImage | null;
  /** Take the current photo off the item. */
  removeImage: boolean;
}



// ── Expenses ──

export interface ExpenseCategory {
  id: string;
  name: string;
}

/** GET /expenses — a bill typed in by hand, or a stock purchase (read-only, "Inventory"). */
export interface Expense {
  id: string;
  source: "manual" | "inventory";
  description: string;
  category: string;
  categoryId: string | null;
  /** ISO date-time. */
  date: string;
  note: string | null;
  amount: number;
  editable: boolean;
}

/** Totals over every matching expense (not only the ones in the list). */
export interface ExpenseStats {
  totalExpenses: number;
  totalSpend: number;
  fromInventory: number;
  manualCount: number;
}

export interface ExpenseList {
  /** Newest 20 (the server doesn't page further). */
  expenses: Expense[];
  stats: ExpenseStats;
}

export interface ExpenseFilters {
  /** A category id, or "inventory" for stock purchases only. */
  categoryId?: string;
  /** "2026-10-01" */
  startDate?: string;
  endDate?: string;
}

/** Add / edit expense dialog, checked and ready to save. */
export interface ExpenseForm {
  description: string;
  categoryId: string;
  amount: number;
  /** "2026-10-11" */
  expenseDate: string;
  note: string;
}


// ── Inventory ──

export interface StockCategory {
  id: string;
  name: string;
}

/** GET /inventory — a raw ingredient with its stock level and category. */
export interface InventoryItem extends StockItem {
  categoryId: string | null;
  createdAt: string;
}

/** GET /inventory/{id}/movement — one change of stock. "deduction" = used by an order. */
export interface StockMovement {
  id: string;
  type: "purchase" | "deduction" | "wastage" | "adjustment";
  quantity: number;
  unitCost: number | null;
  note: string | null;
  orderId: string | null;
  createdAt: string;
  createdByName: string;
}

/** Add / edit ingredient dialog. The unit can't change after adding (like the web). */
export interface InventoryItemForm {
  name: string;
  /** "" = Uncategorized. */
  categoryId: string;
  unit: string;
  minStockLevel: number;
}

/** "Stock Level" dialog: a purchase (added on top, can log an expense) or a recount. */
export type StockChange =
  | { kind: "purchase"; quantity: number; note: string; totalCost?: number; expenseNote: string }
  | { kind: "adjustment"; newQuantity: number; note: string };


// ── Recipes ──

/** One line of the recipe book: a menu item, or one size of it ("Pizza (Large)"). */
export interface RecipeRow {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  price: number;
  /** null = no recipe yet. */
  items: RecipeItem[] | null;
}

/** An ingredient to save: amount per dish, in the ingredient's stock unit. */
export interface RecipeIngredient {
  stockItemId: string;
  quantity: number;
}


// ── Analytics (profit & expense report) ──

/** Money of one period (or all time). Expenses: restocks, wastage and bills typed in by hand. */
export interface ProfitTotals {
  revenue: number;
  purchaseExpense: number;
  wastageExpense: number;
  manualExpense: number;
  /** Revenue − restocks − wastage. */
  grossProfit: number;
  /** Gross profit − manual expenses: the real bottom line. */
  netProfit: number;
}

/** GET /reports/profit — totals, per year and per month ("2026-10"), oldest first. */
export interface ProfitReport {
  overall: ProfitTotals;
  years: (ProfitTotals & { year: string })[];
  months: (ProfitTotals & { month: string })[];
}

/** Month range of the report, "2026-01" … "2026-10" (empty = no limit). */
export interface ProfitRange {
  startMonth?: string;
  endMonth?: string;
}


// ── Settings ──

/** Settings → Account. The password changes only when both passwords are given. */
export interface AccountForm {
  name: string;
  email: string;
  currentPassword?: string;
  newPassword?: string;
}

/** Settings → Outlet. `taxRate` is a percentage like "13" or "13.5". */
export interface OutletForm {
  name: string;
  address: string;
  phone: string;
  taxEnabled: boolean;
  taxRate: string;
  taxName: string;
}

// ── Owner ──

/** GET /outlets — every outlet of the organisation (Owner). */
export interface OrgOutlet {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  skipKitchenWorkflow?: boolean;
  createdAt: string;
}


// ── Owner: overview ──

export type OrgPeriod = "7d" | "30d" | "90d";

export interface OrgPaymentShare {
  total: number;
  count: number;
  percentage: number;
}

/** GET /org/dashboardData — one outlet, or all outlets of the organisation together. */
export interface OrgReport {
  summary: { totalRevenue: number; totalOrders: number; avgOrderValue: number; activeStaff: number };
  /** "Monday"… (7 days), "Week 1"… (30 days), "Month 1"… (90 days). */
  salesTrend: SalesTrendPoint[];
  paymentShare: { netSettledAmount: number; breakdown: Partial<Record<PaymentMethod, OrgPaymentShare>> };
  popularItems: { name: string; categoryName: string | null; totalSold: number; grossSales: number }[];
  leaderboard: { rank: number; staffName: string; totalOrders: number; totalVolume: number }[];
}

/** Branch comparison: revenue and orders of one outlet. */
export interface BranchSummary {
  outletId: string;
  name: string;
  revenue: number;
  orders: number;
}

export interface TrialStatus {
  status: "trial" | "active" | "suspended";
  trialEndsAt: string | null;
}


// ── Owner: outlets ──

export interface OrgOutletForm {
  name: string;
  phone: string;
  address: string;
}


// ── Owner: roles ──

export interface OrgRole {
  id: string;
  name: string;
}

/** GET /permission — one permission of a role, e.g. inventory / products / update. */
export interface RolePermission {
  id: string;
  code: string;
  module: string;
  resource: string;
  action: string;
  isEnabled: boolean;
  isOverridden?: boolean;
  isProtected?: boolean;
  /** Where the setting comes from: "global", "organization" or "outlet". */
  level?: string;
}

export type PermissionsByModule = Record<string, RolePermission[]>;


// ── Owner: organisation ──

/** Settings → Organization: name and logo (a new photo is uploaded when saving). */
export interface OrganizationForm {
  name: string;
  logo: PickedImage | null;
  removeLogo: boolean;
}
