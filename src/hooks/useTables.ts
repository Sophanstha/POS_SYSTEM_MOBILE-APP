import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DiningTable, TableStatus } from "../types/pos";
import { useOutletId } from "./shared";
import { getTables, setTablePosition, setTableStatus } from "../api/pos";
import type { Point } from "../lib/FloorPlan";
import { POLL_MS, queryKeys } from "../lib/queryKey";


const byTableNumber = (a: DiningTable, b: DiningTable) =>
  a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true });

/** All tables of the outlet, sorted T1, T2 … T10. Polls every 5 s. */
export function useTables() {
  const outletId = useOutletId();

  return useQuery({
    queryKey: queryKeys.tables(outletId ?? ""),
    queryFn: getTables,
    enabled: !!outletId,
    refetchInterval: POLL_MS,
    select: (tables) => [...tables].sort(byTableNumber),
  });
}

/** Change a table's status. Updates the screen immediately and rolls back on error. */
export function useSetTableStatus() {
  const outletId = useOutletId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tableId, status }: { tableId: string; status: TableStatus }) =>
      setTableStatus(tableId, status),

    onMutate: async ({ tableId, status }) => {
      if (!outletId) return { previous: undefined };
      const key = queryKeys.tables(outletId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DiningTable[]>(key);
      queryClient.setQueryData<DiningTable[]>(key, (old) =>
        old?.map((t) => (t.id === tableId ? { ...t, status } : t)),
      );
      return { previous };
    },

    onError: (_error, _vars, context) => {
      if (outletId && context?.previous) {
        queryClient.setQueryData(queryKeys.tables(outletId), context.previous);
      }
    },

    onSettled: () => {
      if (outletId) queryClient.invalidateQueries({ queryKey: queryKeys.tables(outletId) });
    },
  });
}

/** Update the cached table list straight away, roll back if the server says no. */
function useOptimisticTables<TVars>(
  mutationFn: (vars: TVars) => Promise<unknown>,
  apply: (tables: DiningTable[], vars: TVars) => DiningTable[],
) {
  const outletId = useOutletId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,

    onMutate: async (vars: TVars) => {
      if (!outletId) return { previous: undefined };
      const key = queryKeys.tables(outletId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DiningTable[]>(key);
      queryClient.setQueryData<DiningTable[]>(key, (old) => (old ? apply(old, vars) : old));
      return { previous };
    },

    onError: (_error, _vars, context) => {
      if (outletId && context?.previous) {
        queryClient.setQueryData(queryKeys.tables(outletId), context.previous);
      }
    },

    onSettled: () => {
      if (outletId) queryClient.invalidateQueries({ queryKey: queryKeys.tables(outletId) });
    },
  });
}

const withPosition = (t: DiningTable, p: Point): DiningTable => ({
  ...t,
  positionX: String(p.x),
  positionY: String(p.y),
});

/** Move one table on the floor plan (saved for the web too). */
export function useMoveTable() {
  return useOptimisticTables(
    ({ tableId, position }: { tableId: string; position: Point }) => setTablePosition(tableId, position),
    (tables, { tableId, position }) => tables.map((t) => (t.id === tableId ? withPosition(t, position) : t)),
  );
}

/** Put every table back on the default grid (web: "Reset Layout"). */
export function useResetLayout() {
  return useOptimisticTables(
    (layout: Record<string, Point>) =>
      Promise.all(Object.entries(layout).map(([tableId, position]) => setTablePosition(tableId, position))),
    (tables, layout) => tables.map((t) => (layout[t.id] ? withPosition(t, layout[t.id]) : t)),
  );
}