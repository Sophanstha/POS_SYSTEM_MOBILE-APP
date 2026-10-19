import { Redirect } from "expo-router";

import { useAuth } from "../src/shared/context/AuthContext";
import { useSystem } from "../src/shared/context/SystemContext";

export default function Index() {
  const { status, appRole } = useAuth();
  const system = useSystem();

  if (status === "loading" || system.status === "loading") return null; // splash screen is still showing
  if (!system.system) return <Redirect href="/choose" />; // first open: "What is your business?"
  if (status === "signedOut") return <Redirect href="/login" />;
  // Each business has one folder of screens per role: app/pos/cashier, app/pos/owner… (or app/pos/unsupported).
  return <Redirect href={`/${system.system}/${appRole}`} />;
}
