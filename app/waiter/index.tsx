import RoleHomeScreen, { type HomeModule } from "../../src/screens/RoleHomeScreen";

const MODULES: HomeModule[] = [
  { label: "Dine-In", icon: "silverware-fork-knife", href: "/waiter/tables" },
  { label: "History", icon: "file-document-outline", href: "/waiter/history" },
];

export default function WaiterHome() {
  return <RoleHomeScreen modules={MODULES} />;
}