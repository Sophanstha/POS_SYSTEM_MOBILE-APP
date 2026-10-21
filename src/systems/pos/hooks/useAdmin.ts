import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { changeStock, createCategory, createExpense, createExpenseCategory, createInventoryItem, createProduct, createSize, createStaff, createStockCategory, createTable, deleteCategory, deleteExpense, deleteInventoryItem, deleteProduct, deleteRecipe, deleteSize, deleteTable, getExpenseCategories, getExpenses, getInventory, getManagerDashboard, getMenuItems, getOrganization, getPaymentLedger, getProfitReport, getRecipeBook, getSalesTrend, getStaff, getStockCategories, getStockMovements, removeStaff, renameCategory, saveRecipe, setStaffActive, updateExpense, updateInventoryItem, updateProduct, updateSize, updateStaffInfo, updateStaffRole, updateAccount, updateOutletSettings, updateTable, getOrgOutlets, getOrgReport, getBranchSummaries, getTrialStatus, createOrgOutlet, updateOrgOutlet, setOrgOutletActive, setKitchenWorkflow, deleteOrgOutlet, getOrgRoles, getRolePermissions, updateOrganization, removeOrganizationLogo, getStaffAllOutlets, getProfitReportAllOutlets, getStockAlerts } from "../api/admin";
import { queryKeys } from "../lib/queryKey";
import type { AccountForm, Expense, ExpenseFilters, ExpenseForm, InventoryItem, InventoryItemForm, MenuItem, MenuItemForm, OutletForm, PaymentFilters, ProfitRange, RecipeIngredient, RecipeRow, StaffForm, StaffMember, StockChange, TableForm, TrendPeriod, OrgOutlet, OrgOutletForm, OrgPeriod, OrganizationForm } from "../types/admin";
import { useInvalidate, useOutletId } from "./outletScope";
import { setTableStatus } from "../api/pos";
import { Category, DiningTable } from "../types/pos";
import { uploadProductImage } from "../lib/cloudinary";
import { usePosAuth } from "../auth/PosAuthProvider";

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
    queryFn: () => getStaff(),
    enabled: !!outletId,
    staleTime: 30_000,
  });
}

/** Add a staff member, or save changes (details first, then the role — same as the web). */
/** Staff lists of the outlet and of "All outlets", plus the dashboard's staff count. */
function useRefreshStaff() {
  const invalidate = useInvalidate();
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      invalidate(queryKeys.staff, queryKeys.managerDashboard),
      queryClient.invalidateQueries({ queryKey: ["staffAllOutlets"] }),
    ]);
}

export function useSaveStaff() {
  const refreshStaff = useRefreshStaff();
  const outletId = useOutletId();

  return useMutation({
    // targetOutletId: Owner "All outlets" — the outlet to add the new person to.
    mutationFn: async ({ member, form, targetOutletId }: { member: StaffMember | null; form: StaffForm; targetOutletId?: string }) => {
      if (!member) return createStaff(form, targetOutletId ?? outletId);

      const infoChanged =
        form.name !== member.name || form.email !== member.email || form.phone !== (member.phone ?? "");
      if (infoChanged) await updateStaffInfo(member.userId, form, member.outletId);
      if (form.role !== member.role) await updateStaffRole(member.userId, form.role, member.outletId);
    },
    onSettled: () => refreshStaff(),
  });
}

/** Active ⇄ inactive. The pill changes straight away and goes back if the server says no. */
export function useSetStaffActive() {
  const outletId = useOutletId();
  const queryClient = useQueryClient();
  const refreshStaff = useRefreshStaff();

  return useMutation({
    mutationFn: ({ userId, isActive, outletId: memberOutletId }: { userId: string; isActive: boolean; outletId?: string }) =>
      setStaffActive(userId, isActive, memberOutletId),

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

    onSettled: () => refreshStaff(),
  });
}

export function useRemoveStaff() {
  const refreshStaff = useRefreshStaff();

  return useMutation({
    mutationFn: ({ userId, outletId }: { userId: string; outletId?: string }) => removeStaff(userId, outletId),
    onSettled: () => refreshStaff(),
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

// ── Expenses ──

/** Expenses + totals for the chosen category / dates. Keeps the old list while the next loads. */
export function useExpenses(filters: ExpenseFilters) {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.expenses(outletId ?? "", filters.categoryId, filters.startDate, filters.endDate),
    queryFn: () => getExpenses(filters),
    enabled: !!outletId,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useExpenseCategories() {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.expenseCategories(outletId ?? ""),
    queryFn: getExpenseCategories,
    enabled: !!outletId,
    staleTime: 5 * 60_000,
  });
}

export function useCreateExpenseCategory() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: createExpenseCategory,
    onSettled: () => invalidate(queryKeys.expenseCategories),
  });
}

/** Add an expense, or save changes to one. */
export function useSaveExpense() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: ({ expense, form }: { expense: Expense | null; form: ExpenseForm }) =>
      expense ? updateExpense(expense.id, form) : createExpense(form),
    onSettled: () => invalidate(queryKeys.expensesAll),
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: deleteExpense,
    onSettled: () => invalidate(queryKeys.expensesAll),
  });
}


// ── Inventory ──

/** Everything that shows stock: inventory, kitchen wastage list, dashboard alerts, menu "out of stock". */
const STOCK_KEYS = [
  queryKeys.inventory,
  queryKeys.stockItems,
  queryKeys.stockMovementsAll,
  queryKeys.managerDashboard,
  queryKeys.menuItems,
  queryKeys.productsAll,
  queryKeys.variantsAll,
];

/** Every raw ingredient of the active outlet. */
export function useInventory() {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.inventory(outletId ?? ""),
    queryFn: getInventory,
    enabled: !!outletId,
    staleTime: 15_000,
  });
}

export function useStockCategories() {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.stockCategories(outletId ?? ""),
    queryFn: getStockCategories,
    enabled: !!outletId,
    staleTime: 5 * 60_000,
  });
}

export function useCreateStockCategory() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: createStockCategory,
    onSettled: () => invalidate(queryKeys.stockCategories),
  });
}

/** Add an ingredient, or save changes to one. */
export function useSaveInventoryItem() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: ({ item, form }: { item: InventoryItem | null; form: InventoryItemForm }) =>
      item ? updateInventoryItem(item.id, form) : createInventoryItem(form),
    onSettled: () => invalidate(...STOCK_KEYS),
  });
}

export function useDeleteInventoryItem() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: deleteInventoryItem,
    onSettled: () => invalidate(...STOCK_KEYS, queryKeys.recipeBook),
  });
}

/** Restock or recount. A purchase with a cost also shows up in Expenses. */
export function useChangeStock() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: ({ itemId, change }: { itemId: string; change: StockChange }) => changeStock(itemId, change),
    onSettled: () => invalidate(...STOCK_KEYS, queryKeys.expensesAll),
  });
}

/** Stock history of one ingredient; loads only while its row is open. */
export function useStockMovements(stockItemId: string | null) {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.stockMovements(outletId ?? "", stockItemId ?? ""),
    queryFn: () => getStockMovements(stockItemId!),
    enabled: !!outletId && !!stockItemId,
    staleTime: 15_000,
  });
}


// ── Recipes ──

/** Every menu item / size with its recipe. */
export function useRecipeBook() {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.recipeBook(outletId ?? ""),
    queryFn: getRecipeBook,
    enabled: !!outletId,
    staleTime: 60_000,
  });
}

/** Recipes decide what is "out of stock", so the menus and kitchen refresh too. */
const RECIPE_KEYS = [queryKeys.recipeBook, queryKeys.menuItems, queryKeys.productsAll, queryKeys.variantsAll, queryKeys.wastageMenuItems];

export function useSaveRecipe() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: ({ row, ingredients }: { row: RecipeRow; ingredients: RecipeIngredient[] }) => saveRecipe(row, ingredients),
    onSettled: () => invalidate(...RECIPE_KEYS),
  });
}

export function useDeleteRecipe() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: deleteRecipe,
    onSettled: () => invalidate(...RECIPE_KEYS),
  });
}


// ── Analytics ──

/**
 * Profit & expense report of the active outlet — or, for the Owner, all outlets added up.
 * Keeps the old numbers while a new range loads.
 */
export function useProfitReport(range: ProfitRange, allOutlets = false) {
  const outletId = useOutletId();
  const { user } = usePosAuth();
  const outlets = useOrgOutlets(allOutlets);
  const outletIds = (outlets.data ?? []).map((o) => o.id);

  return useQuery({
    queryKey: allOutlets
      ? queryKeys.profitReportAll(user?.organizationId ?? "", range.startMonth, range.endMonth)
      : queryKeys.profitReport(outletId ?? "", range.startMonth, range.endMonth),
    queryFn: () => (allOutlets ? getProfitReportAllOutlets(range, outletIds) : getProfitReport(range)),
    enabled: allOutlets ? outletIds.length > 0 : !!outletId,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}


// ── Settings ──

/** Settings → Account (name, email, password). */
export function useUpdateAccount() {
  return useMutation({ mutationFn: (form: AccountForm) => updateAccount(form) });
}

/** Settings → Outlet. Bills, receipts and the menu header read the outlet again. */
export function useUpdateOutlet() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: ({ outletId, form }: { outletId: string; form: OutletForm }) => updateOutletSettings(outletId, form),
    onSettled: () => invalidate(queryKeys.outlet, queryKeys.organization),
  });
}



// ── Owner ──

/** Every outlet of the organisation — also before an outlet is chosen. */
export function useOrgOutlets(enabled = true) {
  const { status, user } = usePosAuth();

  return useQuery({
    queryKey: queryKeys.orgOutlets(user?.organizationId ?? ""),
    queryFn: getOrgOutlets,
    enabled: enabled && status === "signedIn" && !!user,
    staleTime: 60_000,
  });
}


// ── Owner: overview ──

/** Organisation report for the Owner overview; outletId null = all outlets together. */
export function useOrgReport(period: OrgPeriod, outletId: string | null) {
  const { status, user } = usePosAuth();

  return useQuery({
    queryKey: queryKeys.orgReport(user?.organizationId ?? "", period, outletId ?? "all"),
    queryFn: () => getOrgReport(period, outletId),
    enabled: status === "signedIn" && !!user,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/** Revenue and orders per outlet (branch comparison of the overview). */
export function useBranchSummaries(period: OrgPeriod, outlets: OrgOutlet[] | undefined, enabled: boolean) {
  const { user } = usePosAuth();

  return useQuery({
    queryKey: queryKeys.branchSummaries(user?.organizationId ?? "", period, (outlets ?? []).map((o) => o.id).join(",")),
    queryFn: () => getBranchSummaries(period, outlets ?? []),
    enabled: enabled && !!outlets && outlets.length > 0,
    staleTime: 60_000,
  });
}

/** Free trial / subscription state (for the trial banner). */
export function useTrialStatus() {
  const { status, user } = usePosAuth();

  return useQuery({
    queryKey: queryKeys.trialStatus(user?.organizationId ?? ""),
    queryFn: getTrialStatus,
    enabled: status === "signedIn" && !!user,
    staleTime: 10 * 60_000,
    retry: false,
  });
}


// ── Owner: outlets ──

/** Outlet changes show in the outlet switcher, settings and reports. */
function useRefreshOutlets() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ["orgOutlets", "outlet", "orgReport", "branchSummaries"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    );
}

/** Add an outlet, or save its name / phone / address. */
export function useSaveOrgOutlet() {
  const refreshOutlets = useRefreshOutlets();

  return useMutation({
    mutationFn: ({ outlet, form }: { outlet: OrgOutlet | null; form: OrgOutletForm }) =>
      outlet ? updateOrgOutlet(outlet.id, form) : createOrgOutlet(form),
    onSettled: () => refreshOutlets(),
  });
}

export function useSetOrgOutletActive() {
  const refreshOutlets = useRefreshOutlets();

  return useMutation({
    mutationFn: ({ outletId, isActive }: { outletId: string; isActive: boolean }) => setOrgOutletActive(outletId, isActive),
    onSettled: () => refreshOutlets(),
  });
}

export function useSetKitchenWorkflow() {
  const refreshOutlets = useRefreshOutlets();

  return useMutation({
    mutationFn: ({ outletId, skipKitchen }: { outletId: string; skipKitchen: boolean }) => setKitchenWorkflow(outletId, skipKitchen),
    onSettled: () => refreshOutlets(),
  });
}

export function useDeleteOrgOutlet() {
  const refreshOutlets = useRefreshOutlets();

  return useMutation({
    mutationFn: deleteOrgOutlet,
    onSettled: () => refreshOutlets(),
  });
}


// ── Owner: roles ──

export function useOrgRoles() {
  const { status, user } = usePosAuth();

  return useQuery({
    queryKey: queryKeys.orgRoles(user?.organizationId ?? ""),
    queryFn: getOrgRoles,
    enabled: status === "signedIn" && !!user,
    staleTime: 10 * 60_000,
  });
}

/** Permissions of one role at one outlet; loads when a role is opened. */
export function useRolePermissions(roleId: string | null, outletId: string | null) {
  const { user } = usePosAuth();

  return useQuery({
    queryKey: queryKeys.rolePermissions(user?.organizationId ?? "", roleId ?? "", outletId ?? ""),
    queryFn: () => getRolePermissions(roleId!, outletId),
    enabled: !!roleId,
    staleTime: 0,
  });
}

/** Staff of one outlet (Roles page: how many people have each role there). */
export function useStaffAt(outletId: string | null) {
  return useQuery({
    queryKey: ["staffAt", outletId ?? ""],
    queryFn: () => getStaff(outletId!),
    enabled: !!outletId,
    staleTime: 30_000,
  });
}


// ── Owner: organisation & all outlets ──

/** Settings → Organization: upload the new logo, then save the name and logo (or remove the logo). */
export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (form: OrganizationForm) => {
      if (form.removeLogo && !form.logo) await removeOrganizationLogo();
      const imagePublicId = form.logo ? await uploadProductImage(form.logo) : undefined;
      await updateOrganization({ name: form.name, ...(imagePublicId ? { imagePublicId } : {}) });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["organization"] }),
  });
}

/** Owner "All outlets": the staff of every outlet, each with its outlet name. */
export function useStaffAllOutlets(enabled: boolean) {
  const { user } = usePosAuth();
  const outlets = useOrgOutlets(enabled);

  return useQuery({
    queryKey: queryKeys.staffAllOutlets(user?.organizationId ?? ""),
    queryFn: () => getStaffAllOutlets(outlets.data ?? []),
    enabled: enabled && !!outlets.data,
    staleTime: 30_000,
  });
}

export function useStockAlerts() {
  const outletId = useOutletId();
  const { hasPermission } = usePosAuth();

  return useQuery({
    queryKey: queryKeys.stockAlerts(outletId ?? ""),
    queryFn: getStockAlerts,
    enabled: !!outletId && hasPermission("inventory.stock.read"),
    refetchInterval: 60_000,
  });
}