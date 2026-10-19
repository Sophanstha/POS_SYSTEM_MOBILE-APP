import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { SYSTEMS, type SystemId, type SystemInfo } from "../../systems";
import { setApiSystem } from "../api/client";
import { loadSession } from "../lib/session";
import { clearSavedSystem, loadSystem, saveSystem } from "../lib/systemChoice";

interface SystemContextValue {
  /** "loading" until the saved choice has been read (keeps the splash screen up). */
  status: "loading" | "ready";
  /** The business picked on this phone; null = not picked yet (show the choose screen). */
  system: SystemId | null;
  /** Name, icon, colour… of the picked business. */
  info: SystemInfo | null;
  /** Pick a business and remember it on this phone. */
  chooseSystem: (system: SystemId) => Promise<void>;
  /** Forget the choice ("Change business"). */
  clearSystem: () => Promise<void>;
}

const SystemContext = createContext<SystemContextValue | null>(null);

/** Which business this phone is set up for: POS, IMS or DMS. Saved on the phone. */
export function SystemProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [system, setSystem] = useState<SystemId | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let saved = await loadSystem();
      // Installed before this choice existed and already signed in to POS: stay on POS.
      if (!saved && (await loadSession("pos"))) {
        saved = "pos";
        await saveSystem(saved).catch(() => {});
      }
      if (cancelled) return;
      // API first, so the login restore that follows talks to this business.
      setApiSystem(saved);
      setSystem(saved);
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const chooseSystem = useCallback(async (next: SystemId) => {
    await saveSystem(next);
    setApiSystem(next);
    setSystem(next);
  }, []);

  const clearSystem = useCallback(async () => {
    await clearSavedSystem().catch(() => {});
    setApiSystem(null);
    setSystem(null);
  }, []);

  const value = useMemo<SystemContextValue>(
    () => ({ status, system, info: system ? SYSTEMS[system] : null, chooseSystem, clearSystem }),
    [status, system, chooseSystem, clearSystem],
  );

  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>;
}

export function useSystem() {
  const ctx = useContext(SystemContext);
  if (!ctx) throw new Error("useSystem must be used inside <SystemProvider>");
  return ctx;
}
