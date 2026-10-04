import { useEffect, useRef } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { AgentStatus } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { isRemote } from "@/lib/remote";
import { notices } from "@/lib/notifications";

/** Notifies when a conversation finishes or waits on the user, while the window isn't focused. */
export function useNotifications(host: HostClient | null, enabled: boolean) {
  const granted = useRef<Promise<boolean> | null>(null);
  const on = useRef(enabled);
  useEffect(() => {
    on.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!host || isRemote()) return;
    let previous: AgentStatus[] = [];
    const allowed = () =>
      (granted.current ??= (async () =>
        (await isPermissionGranted()) ||
        (await requestPermission()) === "granted")().catch(() => false));
    return host.subscribe((message) => {
      if (message.type !== "agents") return;
      const found = notices(previous, message.agents);
      previous = message.agents;
      if (!on.current || document.hasFocus() || !found.length) return;
      void allowed().then((ok) => {
        if (!ok) return;
        for (const { title, body } of found) {
          try {
            sendNotification({ title, body });
          } catch {
            // a failed notification is not worth surfacing
          }
        }
      });
    });
  }, [host]);
}
