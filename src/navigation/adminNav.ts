import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";

export type AdminNavItem = {
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  href: string;
};

/** Manager menu, same order as the web sidebar. */
export const MANAGER_NAV: AdminNavItem[] = [
  { label: "Overview", icon: "view-dashboard-outline", href: "/manager" },
  { label: "Analytics", icon: "chart-bar", href: "/manager/analytics" },
  { label: "Manage Staff", icon: "account-group-outline", href: "/manager/staff" },
  { label: "Menu", icon: "silverware-fork-knife", href: "/manager/menu" },
  { label: "Tables", icon: "layers-outline", href: "/manager/tables" },
  { label: "Orders", icon: "shopping-outline", href: "/manager/orders" },
  { label: "Payments", icon: "credit-card-outline", href: "/manager/payments" },
  { label: "Inventory", icon: "package-variant-closed", href: "/manager/inventory" },
  { label: "Expenses", icon: "receipt", href: "/manager/expenses" },
  { label: "Recipes", icon: "book-open-variant", href: "/manager/recipes" },
  { label: "Settings", icon: "cog-outline", href: "/manager/settings" },
];