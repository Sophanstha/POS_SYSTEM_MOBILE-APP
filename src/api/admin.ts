import { api } from "./client";
import type { LedgerPayment, ManagerDashboard, MenuItem, Organization, PaymentFilters, SalesTrendPoint, StaffForm, StaffMember, TableForm, TrendPeriod } from "../types/admin";
import { getProducts, getVariants } from "./pos";
import { ProductVariant } from "../types/pos";
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