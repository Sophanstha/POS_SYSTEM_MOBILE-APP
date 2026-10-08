import { useMutation, useQueries, useQuery } from "@tanstack/react-query";

import { getOrderPayments, getPaymentStatus, payOrder, payPartial } from "../api/pos";
import { orderItemName, roundMoney, toNumber, type OrderDue } from "../lib/pos";
import { POLL_MS, queryKeys } from "../lib/queryKey";
import type { PartialPaymentInput, Payment, PaymentMethod, PayOrderInput, TableOrder } from "../types/pos";
import { useInvalidate, useOutletId } from "./shared";

/** Which items of an order are already paid (per-item payments). */
export function usePaymentStatus(orderId: string | null) {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.paymentStatus(outletId ?? "", orderId ?? ""),
    queryFn: () => getPaymentStatus(orderId!),
    enabled: !!outletId && !!orderId,
  });
}

export interface BillItem {
  orderId: string;
  orderItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  paidQty: number;
  unpaidQty: number;
  taxRate: number;
}

export interface TableBill {
  /** True until every order's payment info has loaded once. */
  loading: boolean;
  error: unknown;
  /** orderItemId → paid / unpaid quantities. */
  items: Map<string, BillItem>;
  unpaidItems: BillItem[];
  /** What each open order still owes (server figure, tax included). */
  dues: OrderDue[];
  totalDue: number;
  unpaidSubtotal: number;
  taxRate: number;
  previousPayments: Payment[];
  paidSoFar: number;
}

/**
 * Everything needed to take payment for a table's open orders:
 * per-item paid quantities (GET …/partial-payment) and the exact balance
 * still due per order (GET …/payment). Polls like the web table screen.
 */
export function useTableBill(orders: TableOrder[]): TableBill {
  const outletId = useOutletId();

  const statuses = useQueries({
    queries: orders.map((o) => ({
      queryKey: queryKeys.paymentStatus(outletId ?? "", o.id),
      queryFn: () => getPaymentStatus(o.id),
      enabled: !!outletId,
      refetchInterval: POLL_MS,
    })),
  });

  const payments = useQueries({
    queries: orders.map((o) => ({
      queryKey: queryKeys.orderPayments(outletId ?? "", o.id),
      queryFn: () => getOrderPayments(o.id),
      enabled: !!outletId,
      refetchInterval: POLL_MS,
    })),
  });

  const items = new Map<string, BillItem>();
  const dues: OrderDue[] = [];
  const previousPayments: Payment[] = [];
  let paidSoFar = 0;

  orders.forEach((order, i) => {
    const status = statuses[i]?.data;
    const taxRate = status?.taxRate ?? toNumber(order.taxRate);

    for (const item of order.items) {
      const s = status?.items.find((x) => x.orderItemId === item.id);
      items.set(item.id, {
        orderId: order.id,
        orderItemId: item.id,
        name: orderItemName(item),
        unitPrice: s?.unitPrice ?? toNumber(item.unitPrice),
        quantity: item.quantity,
        paidQty: s?.paidQty ?? 0,
        unpaidQty: s?.unpaidQty ?? item.quantity,
        taxRate,
      });
    }

    const paid = payments[i]?.data;
    if (paid) {
      const due = roundMoney(paid.balanceDue);
      if (due > 0) dues.push({ orderId: order.id, amount: due });
      previousPayments.push(...paid.payments);
      paidSoFar += paid.totalPaid;
    }
  });

  const unpaidItems = [...items.values()].filter((i) => i.unpaidQty > 0);
  const all = [...statuses, ...payments];

  return {
    loading: all.some((q) => !q.data && !q.error),
    error: all.find((q) => q.error)?.error ?? null,
    items,
    unpaidItems,
    dues,
    totalDue: roundMoney(dues.reduce((sum, d) => sum + d.amount, 0)),
    unpaidSubtotal: roundMoney(unpaidItems.reduce((sum, i) => sum + i.unitPrice * i.unpaidQty, 0)),
    taxRate: statuses[0]?.data?.taxRate ?? toNumber(orders[0]?.taxRate),
    previousPayments: previousPayments.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    paidSoFar: roundMoney(paidSoFar),
  };
}

const AFTER_PAYMENT = [
  queryKeys.tables,
  queryKeys.tableOrdersAll,
  queryKeys.paymentStatusAll,
  queryKeys.orderPaymentsAll,
  queryKeys.historyAll,
];

/**
 * Pay (part of) an order's total. When fully paid the server completes the order
 * and frees the table if nothing else is open on it.
 */
export function usePayOrder() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: (input: PayOrderInput) => payOrder(input),
    onSuccess: () => invalidate(...AFTER_PAYMENT),
  });
}

/**
 * Settle a whole table: one payment per open order, one after another.
 * Refreshes even if one fails half-way, so the screen shows what actually got paid.
 */
export function useSettleTable() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async ({ method, payments }: { method: PaymentMethod; payments: OrderDue[] }) => {
      for (const p of payments) {
        await payOrder({ orderId: p.orderId, amount: p.amount, method });
      }
    },
    onSettled: () => invalidate(...AFTER_PAYMENT),
  });
}

/**
 * Pay for specific items. Note: unlike usePayOrder, the server does NOT free the
 * table when this settles the order — the screen must set the table status.
 */
export function usePayPartial() {
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: (input: PartialPaymentInput) => payPartial(input),
    onSuccess: () => invalidate(...AFTER_PAYMENT),
  });
}