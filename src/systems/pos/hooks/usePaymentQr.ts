import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getPaymentQr, removePaymentQr, savePaymentQr } from "../lib/paymentQr";
import { queryKeys } from "../lib/queryKey";
import { useOutletId } from "./outletScope";

/** This outlet's payment QR picture saved on this phone (null = none yet). */
export function usePaymentQr() {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.paymentQr(outletId ?? ""),
    queryFn: () => (outletId ? getPaymentQr(outletId) : null),
    enabled: !!outletId,
    staleTime: Infinity,
  });
}

/** Save a picked picture as this outlet's payment QR, or remove it (null). */
export function useSetPaymentQr() {
  const outletId = useOutletId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (picked: { uri: string; extension: string } | null) => {
      if (!outletId) throw new Error("No active outlet selected.");
      if (!picked) {
        removePaymentQr(outletId);
        return null;
      }
      return savePaymentQr(outletId, picked.uri, picked.extension);
    },
    onSuccess: (uri) => queryClient.setQueryData(queryKeys.paymentQr(outletId ?? ""), uri),
  });
}