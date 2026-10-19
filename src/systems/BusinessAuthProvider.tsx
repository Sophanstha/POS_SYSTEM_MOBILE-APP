import type { ReactNode } from "react";

import { NoBusinessAuthProvider } from "../shared/context/AuthContext";
import { useSystem } from "../shared/context/SystemContext";
import PosAuthProvider from "./pos/auth/PosAuthProvider";

/**
 * Mounts the login of the chosen business. Changing business swaps the provider, so the
 * old business's state is gone. IMS and DMS add their own provider here when they're built.
 */
export default function BusinessAuthProvider({ children }: { children: ReactNode }) {
  const { status, system } = useSystem();

  if (status === "loading") return <NoBusinessAuthProvider status="loading">{children}</NoBusinessAuthProvider>;
  if (system === "pos") return <PosAuthProvider>{children}</PosAuthProvider>;
  return <NoBusinessAuthProvider status="signedOut">{children}</NoBusinessAuthProvider>;
}
