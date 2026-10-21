import { useEffect, useRef } from "react";


export function useNewIds(ids: string[] | undefined, scope: string, onNew: (fresh: string[]) => void) {
  const last = useRef<{ scope: string; ids: Set<string> } | null>(null);
  const onNewRef = useRef(onNew);

  useEffect(() => {
    onNewRef.current = onNew;
  });

  const key = ids?.join(",");

  useEffect(() => {
    if (!ids) return;
    const before = last.current;
    last.current = { scope, ids: new Set(ids) };
    if (!before || before.scope !== scope) return;
    const fresh = ids.filter((id) => !before.ids.has(id));
    if (fresh.length > 0) onNewRef.current(fresh);
  }, [key, scope]);
}