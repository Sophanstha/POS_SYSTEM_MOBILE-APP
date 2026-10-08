/**
 * Shapes returned by the POS web API (C:\pos_system_ab\POS).
 * Postgres `numeric` columns arrive as strings (e.g. "12.50") — convert with toNumber().
 */

export type TableStatus = "available" | "occupied" | "reserved" | "dirty";
export type TableShape = "square" | "round" | "rectangle";
export type OrderType = "dine_in" | "takeaway";
export type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";
export type KotStatus = "pending" | "preparing" | "ready" | "served" | "cancelled";
export type PaymentMethod = "cash" | "card" | "qr" | "yango" | "foodmandu" | "pathao";

type Numeric = string;


// ── Tables ──

export interface DiningTable {
  id: string;
  outletId: string;
  tableNumber: string;
  capacity: number;
  shape: TableShape;
  positionX: Numeric;
  positionY: Numeric;
  status: TableStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Menu ──

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
  outletId: string;
  sortOrder: number;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number; // already converted by the server
  imageUrl: string | null;
  isActive: boolean;
  isAvailable: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  label: string;
  price: Numeric;
  isDefault: boolean;
  sortOrder: number;
  isAvailable: boolean; // false when out of stock (server checks the recipe)
  isActive: boolean;
}


export interface OutletDetails {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  taxEnabled: boolean;
  taxRate: Numeric; // percentage, e.g. "13.00"
  taxName: string | null;
  skipKitchenWorkflow: boolean;
}

// ── Orders ──

export interface Order {
  id: string;
  outletId: string;
  orderType: OrderType;
  tableId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  orderNumber: number;
  status: OrderStatus;
  subtotal: Numeric;
  tax: Numeric;
  taxRate: Numeric;
  taxAmount: Numeric;
  total: Numeric;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  variantLabel: string | null;
  quantity: number;
  unitPrice: Numeric;
  subtotal: Numeric;
  notes: string | null;
  product?: { id: string; name: string } | null;
}

/** KOT ticket row attached to a table's orders (no items — see KotTicket for those). */
export interface KotTicketRow {
  id: string;
  orderId: string;
  outletId: string;
  status: KotStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TableOrder extends Order {
  items: OrderItem[];
  kotTickets: KotTicketRow[];
}

/** GET /orders/{tableId} */
export interface TableOrdersResponse {
  table: DiningTable;
  orders: TableOrder[];
}

export interface Payment {
  id: string;
  orderId: string;
  outletId: string;
  amount: Numeric;
  method: PaymentMethod;
  receivedBy: string;
  createdAt: string;
}

/** GET /orders (history) — newest first, max 50. */
export interface HistoryOrder extends Order {
  items: OrderItem[];
  table: DiningTable | null;
  payments: Payment[];
}

// ── Kitchen tickets (GET /kot) ──

export interface KotTicketItem {
  id: string; // kot item id → PATCH /kot/singlekot/{id}
  status: KotStatus;
  orderItem: {
    id: string;
    quantity: number;
    notes: string | null;
    variantLabel: string | null;
    product: { name: string } | null;
  };
}

export interface PaymentStatus {
  orderId: string;
  status: OrderStatus;
  total: Numeric;
  taxRate: number;
  items: {
    orderItemId: string;
    productName?: string;
    unitPrice: number;
    quantity: number;
    paidQty: number;
    unpaidQty: number;
    fullyPaid: boolean;
  }[];
}

export interface OrderItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
  notes?: string;
}

export interface CreateDineInOrderInput {
  tableId: string;
  customerName?: string;
  customerPhone?: string;
  items: OrderItemInput[];
}

export interface CreateTakeawayOrderInput {
  customerName?: string;
  customerPhone?: string;
  items: OrderItemInput[];
  payment: { method: PaymentMethod; amountTendered: number };
}

export interface PayOrderInput {
  orderId: string;
  amount: number;
  method: PaymentMethod;
}

// ── Responses ──

interface TaxSummary {
  rate: number;
  amount: number;
  name: string | null;
}

export interface CreateDineInOrderResponse {
  order: Order;
  items: OrderItem[];
  tax: TaxSummary;
}

export interface CreateTakeawayOrderResponse {
  order: Order;
  payment: Payment;
  changeDue: number;
  tax: TaxSummary;
  subtotal: number;
  total: number;
}

export interface PartialPaymentInput {
  orderId: string;
  method: PaymentMethod;
  items: { orderItemId: string; quantity: number }[];
  amountTendered: number;
}


export interface PayOrderResponse {
  payment: Payment;
  order: Order;
  totalPaid: number;
  balanceDue: number;
  changeDue: number;
}

export interface PartialPaymentResponse {
  payment: Payment;
  orderFullyPaid: boolean;
  changeDue: number;
}

export interface HistoryOrder extends Order {
  items: OrderItem[];
  table: DiningTable | null;
  payments: Payment[];
}



export interface KotTicket {
  id: string;
  status: KotStatus;
  createdAt: string;
  order: {
    orderType: OrderType;
    orderNumber: number;
    tableId: string | null;
    customerName: string | null;
    table: { tableNumber: string } | null;
  };
  items: KotTicketItem[];
}

/** GET /orders/{orderId}/payment — what was paid so far and what is still owed (tax included). */
export interface OrderPayments {
  payments: Payment[];
  totalPaid: number;
  balanceDue: number;
  orderTotal: number;
}