import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";

export type AdminNavItem = {
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  href: string;
};

/** Manager menu, same order as the web sidebar. */
export const MANAGER_NAV: AdminNavItem[] = [
  { label: "Overview", icon: "view-dashboard-outline", href: "/pos/manager" },
  { label: "Analytics", icon: "chart-bar", href: "/pos/manager/analytics" },
  { label: "Manage Staff", icon: "account-group-outline", href: "/pos/manager/staff" },
  { label: "Menu", icon: "silverware-fork-knife", href: "/pos/manager/menu" },
  { label: "Tables", icon: "layers-outline", href: "/pos/manager/tables" },
  { label: "Orders", icon: "shopping-outline", href: "/pos/manager/orders" },
  { label: "Payments", icon: "credit-card-outline", href: "/pos/manager/payments" },
  { label: "Inventory", icon: "package-variant-closed", href: "/pos/manager/inventory" },
  { label: "Expenses", icon: "receipt", href: "/pos/manager/expenses" },
  { label: "Recipes", icon: "book-open-variant", href: "/pos/manager/recipes" },
  { label: "Settings", icon: "cog-outline", href: "/pos/manager/settings" },
];


/** Owner menu, same order as the web: the outlet pages work on the outlet picked at the top. */
export const OWNER_NAV: AdminNavItem[] = [
  { label: "Overview", icon: "view-dashboard-outline", href: "/pos/owner" },
  { label: "Analytics", icon: "chart-bar", href: "/pos/owner/analytics" },
  { label: "Manage Staff", icon: "account-group-outline", href: "/pos/owner/staff" },
  { label: "Outlets", icon: "storefront-outline", href: "/pos/owner/outlets" },
  { label: "Tables", icon: "layers-outline", href: "/pos/owner/tables" },
  { label: "Orders", icon: "shopping-outline", href: "/pos/owner/orders" },
  { label: "Menu", icon: "silverware-fork-knife", href: "/pos/owner/menu" },
  { label: "Payments", icon: "credit-card-outline", href: "/pos/owner/payments" },
  { label: "Inventory", icon: "package-variant-closed", href: "/pos/owner/inventory" },
  { label: "Expenses", icon: "receipt", href: "/pos/owner/expenses" },
  { label: "Recipes", icon: "book-open-variant", href: "/pos/owner/recipes" },
  { label: "Roles", icon: "shield-check-outline", href: "/pos/owner/roles" },
  { label: "Settings", icon: "cog-outline", href: "/pos/owner/settings" },
];