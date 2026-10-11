import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createCategory, createProduct, createSize, createStaff, createTable, deleteCategory, deleteProduct, deleteSize, deleteTable, getManagerDashboard, getMenuItems, getOrganization, getPaymentLedger, getSalesTrend, getStaff, removeStaff, renameCategory, setStaffActive, updateProduct, updateSize, updateStaffInfo, updateStaffRole, updateTable } from "../api/admin";
import { queryKeys } from "../lib/queryKey";
import type { MenuItem, MenuItemForm, PaymentFilters, StaffForm, StaffMember, TableForm, TrendPeriod } from "../types/admin";
import { useInvalidate, useOutletId } from "./shared";
import { setTableStatus } from "../api/pos";
import { Category, DiningTable } from "../types/pos";
import { uploadProductImage } from "../lib/cloudinary";

/** Organisation name and logo for the menu header. Rarely changes. */
export function useOrganization() {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.organization(outletId ?? ""),
    queryFn: getOrganization,
    enabled: !!outletId,
    staleTime: 30 * 60_000,
  });
}

/** Overview numbers of the active outlet. */
export function useManagerDashboard() {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.managerDashboard(outletId ?? ""),
    queryFn: getManagerDashboard,
    enabled: !!outletId,
    staleTime: 60_000,
  });
}

/** Sales trend for 24H / 7D / 30D. Keeps the old bars on screen while the next period loads. */
export function useSalesTrend(period: TrendPeriod) {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.salesTrend(outletId ?? "", period),
    queryFn: () => getSalesTrend(period),
    enabled: !!outletId,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/** Payment ledger of the active outlet, filtered by day and/or method. */
export function usePaymentLedger(filters: PaymentFilters) {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.paymentLedger(outletId ?? "", filters.date, filters.method),
    queryFn: () => getPaymentLedger(filters),
    enabled: !!outletId,
    staleTime: 30_000,
  });
}



// ── Staff ──

/** Every staff member of the active outlet. */
export function useStaff() {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.staff(outletId ?? ""),
    queryFn: getStaff,
    enabled: !!outletId,
    staleTime: 30_000,
  });
}

/** Add a staff member, or save changes (details first, then the role — same as the web). */
export function useSaveStaff() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async ({ member, form }: { member: StaffMember | null; form: StaffForm }) => {
      if (!member) return createStaff(form);

      const infoChanged =
        form.name !== member.name || form.email !== member.email || form.phone !== (member.phone ?? "");
      if (infoChanged) await updateStaffInfo(member.userId, form);
      if (form.role !== member.role) await updateStaffRole(member.userId, form.role);
    },
    onSettled: () => invalidate(queryKeys.staff, queryKeys.managerDashboard),
  });
}

/** Active ⇄ inactive. The pill changes straight away and goes back if the server says no. */
export function useSetStaffActive() {
  const outletId = useOutletId();
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) => setStaffActive(userId, isActive),

    onMutate: async ({ userId, isActive }) => {
      if (!outletId) return { previous: undefined };
      const key = queryKeys.staff(outletId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<StaffMember[]>(key);
      queryClient.setQueryData<StaffMember[]>(key, (old) =>
        old?.map((s) => (s.userId === userId ? { ...s, isActive } : s)),
      );
      return { previous };
    },

    onError: (_error, _vars, context) => {
      if (outletId && context?.previous) queryClient.setQueryData(queryKeys.staff(outletId), context.previous);
    },

    onSettled: () => invalidate(queryKeys.staff, queryKeys.managerDashboard),
  });
}

export function useRemoveStaff() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: removeStaff,
    onSettled: () => invalidate(queryKeys.staff, queryKeys.managerDashboard),
  });
}


// ── Tables ──

/** Add a table, or save changes. A new status is a separate call, like the web. */
export function useSaveTable() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async ({ table, form }: { table: DiningTable | null; form: TableForm }) => {
      const { status, ...fields } = form;
      if (table) {
        await updateTable(table.id, fields);
        if (status !== table.status) await setTableStatus(table.id, status);
        return;
      }
      const created = await createTable(fields);
      if (created?.id && status !== "available") await setTableStatus(created.id, status);
    },
    onSettled: () => invalidate(queryKeys.tables),
  });
}

export function useDeleteTable() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: deleteTable,
    onSettled: () => invalidate(queryKeys.tables),
  });
}




// ── Menu ──

/** Every menu item of the outlet with its sizes. */
export function useMenuItems() {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.menuItems(outletId ?? ""),
    queryFn: getMenuItems,
    enabled: !!outletId,
    staleTime: 30_000,
  });
}

/**
 * Add or save a menu item, same steps as the web: upload the new photo, save the item,
 * then add / change / remove its sizes.
 */
export function useSaveMenuItem() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async ({ item, form }: { item: MenuItem | null; form: MenuItemForm }) => {
      const imagePublicId = form.image ? await uploadProductImage(form.image) : form.removeImage ? "" : undefined;
      const fields = {
        name: form.name,
        categoryId: form.categoryId,
        price: form.price,
        // Editing: an empty description clears it. Adding: leave it out.
        description: item ? form.description : form.description || undefined,
        ...(imagePublicId !== undefined && { imagePublicId }),
      };

      let productId = item?.id ?? null;
      if (item) await updateProduct(item.id, fields);
      else productId = await createProduct(fields);
      if (!productId) return;

      const before = item?.sizes ?? [];
      const keep = form.sizes ?? [];
      const keptIds = new Set(keep.map((s) => s.id).filter(Boolean));
      await Promise.all(before.filter((s) => !keptIds.has(s.id)).map((s) => deleteSize(productId, s.id)));

      for (const size of keep) {
        if (!size.id) {
          await createSize(productId, size);
          continue;
        }
        const old = before.find((s) => s.id === size.id);
        if (old && (old.label !== size.label || old.price !== size.price)) await updateSize(productId, size.id, size);
      }
    },
    // The waiter / cashier menus show the change too.
    onSettled: () => invalidate(queryKeys.menuItems, queryKeys.productsAll, queryKeys.variantsAll),
  });
}

export function useDeleteMenuItem() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: deleteProduct,
    onSettled: () => invalidate(queryKeys.menuItems, queryKeys.productsAll, queryKeys.variantsAll),
  });
}

/** Add a category, or rename one. */
export function useSaveCategory() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: ({ category, name }: { category: Category | null; name: string }) =>
      category ? renameCategory(category.id, name) : createCategory(name),
    onSettled: () => invalidate(queryKeys.categories, queryKeys.menuItems, queryKeys.productsAll),
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: deleteCategory,
    onSettled: () => invalidate(queryKeys.categories, queryKeys.menuItems, queryKeys.productsAll),
  });
}