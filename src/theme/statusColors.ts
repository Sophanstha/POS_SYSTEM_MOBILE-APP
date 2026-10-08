import type { KotStatus, OrderStatus, TableStatus } from "../types/pos";
import type { AppTheme } from "./paperTheme";

/** Same colour meaning as the web POS: green free, red busy, blue reserved, gold cleaning. */
export function tableStatusColor(theme: AppTheme, status: TableStatus): string {
  switch (status) {
    case "available":
      return theme.colors.success;
    case "occupied":
      return theme.colors.error;
    case "reserved":
      return theme.colors.info;
    case "dirty":
      return theme.colors.gold;
  }
}

export function kotStatusColor(theme: AppTheme, status: KotStatus): string {
  switch (status) {
    case "pending":
      return theme.colors.onSurfaceVariant;
    case "preparing":
      return theme.colors.warning;
    case "ready":
      return theme.colors.success;
    case "served":
      return theme.colors.info;
    case "cancelled":
      return theme.colors.error;
  }
}

export function orderStatusColor(theme: AppTheme, status: OrderStatus): string {
  switch (status) {
    case "completed":
      return theme.colors.success;
    case "cancelled":
      return theme.colors.error;
    default:
      return theme.colors.warning;
  }
}