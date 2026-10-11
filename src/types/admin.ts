import { PaymentMethod, Product, TableShape, TableStatus } from "./pos";

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