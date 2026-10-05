import RoleHomeScreen, { type HomeModule } from "../../src/screens/RoleHomeScreen";

const MODULES: HomeModule[] = [
  { label: "Takeaway", icon: "shopping-outline", href: "/cashier/takeaway" },
  { label: "Dine-In", icon: "silverware-fork-knife", href: "/cashier/tables" },
  { label: "History", icon: "file-document-outline", href: "/cashier/history" },
];

export default function CashierHome() {
  return <RoleHomeScreen modules={MODULES} />;
}