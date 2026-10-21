import { useNewIds } from "../../../shared/hooks/useNewIds";
import { haptics } from "../../../shared/lib/haptics";
import type { OrderType } from "../types/pos";
import { useKotTickets } from "./useKot";
import { useOutletId } from "./outletScope";

export function useFoodReadyAlert(orderType: OrderType) {
  const outletId = useOutletId();
  const tickets = useKotTickets();

  const ready = tickets.data
    ?.filter((t) => t.status === "ready" && t.order.orderType === orderType)
    .map((t) => t.id);

  useNewIds(ready, outletId ?? "", () => haptics.attention());
}