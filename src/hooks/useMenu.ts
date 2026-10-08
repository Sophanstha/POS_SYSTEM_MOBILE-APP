import { useQuery } from "@tanstack/react-query";

import { getCategories, getOutlet, getProducts, getVariants } from "../api/pos";
import { useOutletId } from "./shared";
import { queryKeys } from "../lib/queryKey";

const MINUTE = 60_000;

export function useCategories() {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.categories(outletId ?? ""),
    queryFn: getCategories,
    enabled: !!outletId,
    staleTime: 5 * MINUTE,
  });
}

/** Products of one category, or all products when categoryId is null. */
export function useProducts(categoryId: string | null) {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.products(outletId ?? "", categoryId),
    queryFn: () => getProducts(categoryId ?? undefined),
    enabled: !!outletId,
    staleTime: MINUTE,
  });
}

/**
 * Sizes of one product. Loaded only when needed (e.g. product tapped) instead of
 * one request per product like the web. Availability depends on stock, so keep it short.
 */
export function useVariants(productId: string | null) {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.variants(outletId ?? "", productId ?? ""),
    queryFn: () => getVariants(productId!, outletId),
    enabled: !!outletId && !!productId,
    staleTime: 30_000,
  });
}

/** Outlet details — mainly tax settings for the bill preview. */
export function useOutlet() {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.outlet(outletId ?? ""),
    queryFn: () => getOutlet(outletId!),
    enabled: !!outletId,
    staleTime: 10 * MINUTE,
  });
}