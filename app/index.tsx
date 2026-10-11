import { Redirect } from "expo-router";

import { useAuth } from "../src/context/AuthContext";

export default function Index() {
  const { status, appRole } = useAuth();

  if (status === "loading") return null; // splash screen is still showing
  if (status === "signedOut") return <Redirect href="/login" />;
  if (appRole === "waiter") return <Redirect href="/waiter" />;
  if (appRole === "cashier") return <Redirect href="/cashier" />;
  if (appRole === "kitchen") return <Redirect href="/kitchen" />;
  if (appRole === "manager") return <Redirect href="/manager" />;
  return <Redirect href="/unsupported" />;
}
