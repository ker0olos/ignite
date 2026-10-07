import { useEffect, useRef } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { AgentStatus } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { isRemote } from "@/lib/remote";
import { chime, notices } from "@/lib/notifications";
import type { Settings } from "@/lib/settings";
import { isMac } from "@/lib/window";

/**
 * Notifies when a conversation finishes or waits on the user, while the
 * window isn't focused, with a chime unless `sound` is off.
 */
export function useNotifications(
  host: HostClient | null,
  settings: Settings["notifications"],
  mac = isMac(),
) {
  const granted = useRef<Promise<boolean> | null>(null);
  const on = useRef(settings);
  useEffect(() => {
    on.current = settings;
  }, [settings]);

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
      if (!on.current.enabled || document.hasFocus() || !found.length) return;
      void allowed().then((ok) => {
        if (!ok) return;
        for (const { title, body } of found) {
          try {
            const sound = on.current.sound ? { sound: chime(mac) } : {};
            sendNotification({ title, body, ...sound });
          } catch {
            // a failed notification is not worth surfacing
          }
        }
      });
    });
  }, [host, mac]);
}
