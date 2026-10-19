import RoleHomeScreen, { type HomeModule } from "../../../src/systems/pos/screens/RoleHomeScreen";

const MODULES: HomeModule[] = [
  { label: "Takeaway", icon: "shopping-outline", href: "/pos/cashier/takeaway" },
  { label: "Dine-In", icon: "silverware-fork-knife", href: "/pos/cashier/tables" },
  { label: "History", icon: "file-document-outline", href: "/pos/cashier/history" },
];

export default function CashierHome() {
  return <RoleHomeScreen modules={MODULES} />;
}