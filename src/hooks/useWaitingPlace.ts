import { createContext, useContext, useState } from "react";
import { inArrivalOrder } from "@/lib/toolRows";

/** The ids of the calls waiting for the user, in order; only the first is shown in full and takes the keyboard. */
export const WaitingCallsContext = createContext<string[]>([]);

/** Where `toolCallId` stands among the waiting calls: -1 when it isn't one of them. */
export function useWaitingPlace(toolCallId: string) {
  const queue = useContext(WaitingCallsContext);
  return { place: queue.indexOf(toolCallId), count: queue.length };
}

/** The waiting calls in the order they began to wait, the same array until that changes. */
export function useWaitingOrder(waiting: string[]): string[] {
  const [order, setOrder] = useState<string[]>([]);
  const next = inArrivalOrder(order, waiting);
  if (next.join() === order.join()) return order;
  setOrder(next);
  return next;
}
