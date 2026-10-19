import { useCallback, useMemo, useState } from "react";

/** Rows shown at first, and added each time the list reaches its end. */
export const PAGE_SIZE = 20;

/**
 * "Load more as you scroll" for a list: shows the first 20 rows, then 20 more each time
 * `loadMore` is called (FlatList onEndReached). Changing `resetKey` (search, filters)
 * starts from the first page again; a background refresh of the data doesn't.
 */
export function usePagedList<T>(items: T[], resetKey: string, pageSize = PAGE_SIZE) {
  const [count, setCount] = useState(pageSize);
  const [key, setKey] = useState(resetKey);

  // New search / filter: back to the first page (set during render, so no flash of the old page).
  if (key !== resetKey) {
    setKey(resetKey);
    setCount(pageSize);
  }

  const visible = useMemo(() => items.slice(0, count), [items, count]);
  const hasMore = items.length > count;

  const loadMore = useCallback(() => {
    if (hasMore) setCount((c) => c + pageSize);
  }, [hasMore, pageSize]);

  return { visible, hasMore, loadMore, shown: visible.length, total: items.length };
}
