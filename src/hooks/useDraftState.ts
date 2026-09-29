import { useEffect, useState } from "react";
import type { SessionState } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import type { Pending } from "@/hooks/useComposerActions";

/**
 * In a folder with no conversation, what its first message would start with:
 * the models, and the saved model and effort or those picked since. Asked
 * again as picks change (effort depends on the model) and providers connect.
 */
export function useDraftState(
  opened: HostClient | null,
  none: boolean,
  pending: Pending,
  refresh: unknown,
) {
  const [state, setState] = useState<SessionState | null>(null);
  const { model, level } = pending;
  const provider = model?.provider;
  const id = model?.id;

  useEffect(() => {
    if (!opened || !none) return;
    let live = true;
    opened
      .request({
        type: "draft_state",
        ...(provider && id && { model: { provider, id } }),
        ...(level && { level }),
      })
      .then((s) => live && setState(s))
      // Without it the composer just offers no model or effort menu.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [opened, none, provider, id, level, refresh]);

  return none ? state : null;
}
