import { useCallback, useEffect, useRef, useState } from "react";
import type { ProviderStatus } from "../../shared/hostProtocol";
import { DEMO_FOLDER } from "@/lib/demo";
import { store } from "@/lib/store";

/**
 * Whether the full-window connect screen is showing. It opens by itself once,
 * on first launch, when no provider is connected; after that only on request.
 * Dismissing it (Continue or Skip) is remembered for every window. Demo
 * mode needs no provider, so it never opens by itself there.
 */
export function useConnectScreen(
  statuses: ProviderStatus[] | null,
  demo = !!DEMO_FOLDER,
) {
  const [open, setOpen] = useState(false);
  const decided = useRef(false);

  useEffect(() => {
    if (decided.current || !statuses || demo) return;
    decided.current = true;
    const anyConnected = statuses.some((s) => s.connected);
    store
      .then((s) => s.get<boolean>("connectScreenSeen"))
      .then((seen) => {
        if (!seen && !anyConnected) setOpen(true);
      });
  }, [statuses, demo]);

  const show = useCallback(() => setOpen(true), []);
  const dismiss = useCallback(() => {
    setOpen(false);
    store.then((s) => s.set("connectScreenSeen", true));
  }, []);

  return { open, show, dismiss };
}
