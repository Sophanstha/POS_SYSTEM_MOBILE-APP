import { api } from "./client";
import type {
  Category,
  CreateDineInOrderInput,
  CreateDineInOrderResponse,
  CreateTakeawayOrderInput,
  CreateTakeawayOrderResponse,
  DiningTable,
  HistoryOrder,
  KotStatus,
  KotTicket,
  OrderPayments,
  OutletDetails,
  PartialPaymentInput,
  PartialPaymentResponse,
  PayOrderInput,
  PayOrderResponse,
  PaymentStatus,
  Product,
  ProductVariant,
  TableOrdersResponse,
  TableStatus,
} from "../types/pos";

// ── Tables ──

export async function getTables(): Promise<DiningTable[]> {
  const { data } = await api.get<{ tables: DiningTable[] }>("/tables");
  return data.tables ?? [];
}

export async function setTableStatus(tableId: string, status: TableStatus): Promise<void> {
  await api.patch(`/tables/${tableId}/status`, { status });
}

// ── Menu ──

export async function getCategories(): Promise<Category[]> {
  const { data } = await api.get<{ categories: Category[] }>("/categories");
  return data.categories ?? [];
}

const PRODUCT_PAGE_SIZE = 100; // server maximum

/**
 * GET /product is paginated (default 20, max 100) and nests the list:
 * { products: { products: [...], total }, pagination }. Fetch every page.
 */
export async function getProducts(categoryId?: string): Promise<Product[]> {
  const all: Product[] = [];

  for (let page = 1; ; page++) {
    const { data } = await api.get<{
      products: Product[] | { products: Product[]; total: number };
    }>("/product", {
      params: { limit: PRODUCT_PAGE_SIZE, page, ...(categoryId ? { categoryId } : {}) },
    });

    const list = Array.isArray(data.products) ? data.products : (data.products?.products ?? []);
    const total = Array.isArray(data.products) ? list.length : (data.products?.total ?? list.length);
    all.push(...list);

    if (list.length < PRODUCT_PAGE_SIZE || all.length >= total) return all;
  }
}

export async function getVariants(productId: string, outletId?: string | null): Promise<ProductVariant[]> {
  const { data } = await api.get<{ variants: ProductVariant[] }>(`/product/${productId}/variants`, {
    params: outletId ? { outletId } : undefined,
  });
  return data.variants ?? [];
}

export async function getOutlet(outletId: string): Promise<OutletDetails> {
  const { data } = await api.get<{ outlet: OutletDetails }>(`/outlets/${outletId}`);
  return data.outlet;
}

// ── Orders ──

/** Active (not completed/cancelled) orders on a table. Note: the path takes a TABLE id. */
export async function getTableOrders(tableId: string): Promise<TableOrdersResponse> {
  const { data } = await api.get<TableOrdersResponse>(`/orders/${tableId}`);
  return { table: data.table, orders: data.orders ?? [] };
}

export async function getOrderHistory(range: { startDate?: string; endDate?: string }): Promise<HistoryOrder[]> {
  const { data } = await api.get<{ orders: HistoryOrder[] }>("/orders", { params: range });
  return data.orders ?? [];
}

export async function createDineInOrder(input: CreateDineInOrderInput): Promise<CreateDineInOrderResponse> {
  const { data } = await api.post<CreateDineInOrderResponse>("/orders/dine-in", input);
  return data;
}

/** Creates AND pays a takeaway order in one call. */
export async function createTakeawayOrder(input: CreateTakeawayOrderInput): Promise<CreateTakeawayOrderResponse> {
  const { data } = await api.post<CreateTakeawayOrderResponse>("/orders/takeaway", input);
  return data;
}

/** Cancels the order and its kitchen tickets; frees the table if nothing else is open on it. */
export async function cancelOrder(orderId: string): Promise<void> {
  await api.delete(`/orders/${orderId}`);
}

// ── Payments ──

export async function payOrder({ orderId, ...body }: PayOrderInput): Promise<PayOrderResponse> {
  const { data } = await api.post<PayOrderResponse>(`/orders/${orderId}/payment`, body);
  return data;
}

export async function getPaymentStatus(orderId: string): Promise<PaymentStatus> {
  const { data } = await api.get<PaymentStatus>(`/orders/${orderId}/partial-payment`);
  return data;
}

export async function payPartial({ orderId, ...body }: PartialPaymentInput): Promise<PartialPaymentResponse> {
  const { data } = await api.post<PartialPaymentResponse>(`/orders/${orderId}/partial-payment`, body);
  return data;
}

// ── Kitchen tickets ──

/** Note: the server returns EVERY ticket for the outlet (no filter) — filter on our side. */
export async function getKotTickets(): Promise<KotTicket[]> {
  const { data } = await api.get<{ tickets: KotTicket[] }>("/kot");
  return data.tickets ?? [];
}

export async function setKotTicketStatus(ticketId: string, status: KotStatus): Promise<void> {
  await api.patch(`/kot/${ticketId}`, { status });
}

export async function setKotItemStatus(
  kotItemId: string,
  status: Exclude<KotStatus, "pending" | "cancelled">,
): Promise<void> {
  await api.patch(`/kot/singlekot/${kotItemId}`, { status });
}

/** Payments already made on an order and the balance still due (server-calculated, tax included). */
export async function getOrderPayments(orderId: string): Promise<OrderPayments> {
  const { data } = await api.get<OrderPayments>(`/orders/${orderId}/payment`);
  return data;
}

/** Where the table sits on the floor plan, in the web's pixels (shared with the web POS). */
export async function setTablePosition(tableId: string, position: { x: number; y: number }): Promise<void> {
  await api.patch(`/tables/${tableId}`, { positionX: position.x, positionY: position.y });
}
