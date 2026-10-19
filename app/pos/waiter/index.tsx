import RoleHomeScreen, { type HomeModule } from "../../../src/systems/pos/screens/RoleHomeScreen";

const MODULES: HomeModule[] = [
  { label: "Dine-In", icon: "silverware-fork-knife", href: "/pos/waiter/tables" },
  { label: "History", icon: "file-document-outline", href: "/pos/waiter/history" },
];

export default function WaiterHome() {
  return <RoleHomeScreen modules={MODULES} />;
}