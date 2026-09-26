import { useCallback, useEffect, useRef, useState } from "react";
import type { ProviderStatus } from "../../shared/hostProtocol";
import { store } from "@/lib/store";

/**
 * Whether the full-window connect screen is showing. It opens by itself once,
 * on first launch, when no provider is connected; after that only on request.
 * Dismissing it (Continue or Skip) is remembered for every window.
 */
export function useConnectScreen(statuses: ProviderStatus[] | null) {
  const [open, setOpen] = useState(false);
  const decided = useRef(false);

  useEffect(() => {
    if (decided.current || !statuses) return;
    decided.current = true;
    const anyConnected = statuses.some((s) => s.connected);
    store
      .then((s) => s.get<boolean>("connectScreenSeen"))
      .then((seen) => {
        if (!seen && !anyConnected) setOpen(true);
      });
  }, [statuses]);

  const show = useCallback(() => setOpen(true), []);
  const dismiss = useCallback(() => {
    setOpen(false);
    store.then((s) => s.set("connectScreenSeen", true));
  }, []);

  return { open, show, dismiss };
}
