import { createContext, useContext, useState } from "react";
import { inArrivalOrder } from "@/lib/toolRows";

/** The ids of the calls waiting for the user, in order; only the first is shown in full and takes the keyboard. */
export const WaitingCallsContext = createContext<string[]>([]);

/** Where `toolCallId` stands among the waiting calls: -1 when it isn't one of them. */
export function useWaitingPlace(toolCallId: string) {
  const queue = useContext(WaitingCallsContext);
  return { place: queue.indexOf(toolCallId), count: queue.length };
}

const NONE: string[] = [];

/**
 * The waiting calls in the order they began to wait, the same array until
 * that changes; none while the conversation is hidden, so none takes the keyboard.
 */
export function useWaitingOrder(waiting: string[], shown = true): string[] {
  const [order, setOrder] = useState<string[]>([]);
  const next = inArrivalOrder(order, waiting);
  const same = next.join() === order.join();
  if (!same) setOrder(next);
  if (!shown) return NONE;
  return same ? order : next;
}
