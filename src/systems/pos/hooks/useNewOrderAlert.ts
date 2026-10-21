import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useState } from "react";

import { useNewIds } from "../../../shared/hooks/useNewIds";
import { haptics } from "../../../shared/lib/haptics";
import type { KotTicket } from "../types/pos";
import { useOutletId } from "./outletScope";

const DING = require("../../../../assets/sounds/kitchen-ding.wav");

/** While a new order isn't seen yet, ring again this often. */
const REPEAT_MS = 20_000;

/**
 * Kitchen bell: rings and buzzes when a new ticket reaches the board, then again every 20 s
 * until a cook taps the banner or starts every new dish. Tickets already on the board when
 * the screen opens don't ring. `soundOn` false = buzz and banner only.
 */
export function useNewOrderAlert(tickets: KotTicket[] | undefined, soundOn: boolean) {
  const outletId = useOutletId();
  const player = useAudioPlayer(DING);
  const [unseen, setUnseen] = useState(0);

  // iPhone: ring even with the silent switch on.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const ring = useCallback(() => {
    haptics.attention();
    if (!soundOn) return;
    player
      .seekTo(0)
      .then(() => player.play())
      .catch(() => {});
  }, [player, soundOn]);

  useNewIds(tickets?.map((t) => t.id), outletId ?? "", (fresh) => {
    setUnseen((n) => n + fresh.length);
    ring();
  });

  // Nothing left in "New Orders" → nothing left to ring for.
  const waiting = tickets?.some((t) => t.items.some((i) => i.status === "pending")) ?? false;
  useEffect(() => {
    if (!waiting) setUnseen(0);
  }, [waiting]);

  useEffect(() => {
    if (unseen === 0) return;
    const id = setInterval(ring, REPEAT_MS);
    return () => clearInterval(id);
  }, [unseen, ring]);

  const markSeen = useCallback(() => setUnseen(0), []);

  return { unseen, markSeen };
}