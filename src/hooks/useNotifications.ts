import { useEffect, useLayoutEffect, useRef } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { AgentStatus } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { isRemote } from "@/lib/remote";
import { chime, notices, stillAsNotified } from "@/lib/notifications";
import type { Settings } from "@/lib/settings";
import { isMac } from "@/lib/window";

type Target = { cwd: string; session: string; waiting: boolean; at: number };

const TARGET_MS = 10 * 60_000;

/**
 * Notifies when a conversation finishes or waits on the user, while the
 * window isn't focused, with a chime unless `sound` is off. The window's
 * next focus shows the notified conversation, a waiting one first.
 */
export function useNotifications(
  host: HostClient | null,
  settings: Settings["notifications"],
  show: (cwd: string, session: string) => void,
  mac = isMac(),
) {
  const granted = useRef<Promise<boolean> | null>(null);
  const on = useRef(settings);
  const latestShow = useRef(show);
  const target = useRef<Target | null>(null);
  useLayoutEffect(() => {
    on.current = settings;
    latestShow.current = show;
  });

  // ponytail: desktop notifications report no click (onAction is mobile-only),
  // so a return to the window within TARGET_MS counts as one.
  useEffect(() => {
    const onFocus = () => {
      const t = target.current;
      target.current = null;
      if (t && Date.now() - t.at < TARGET_MS)
        latestShow.current(t.cwd, t.session);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

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
      const t = target.current;
      if (t && !stillAsNotified(t, message.agents)) target.current = null;
      if (!on.current.enabled || document.hasFocus() || !found.length) return;
      void allowed().then((ok) => {
        if (!ok || document.hasFocus()) return;
        for (const { title, body, ...notice } of found) {
          try {
            const sound = on.current.sound ? { sound: chime(mac) } : {};
            sendNotification({ title, body, ...sound });
            if (notice.waiting || !target.current?.waiting)
              target.current = { ...notice, at: Date.now() };
          } catch {
            // a failed notification is not worth surfacing
          }
        }
      });
    });
  }, [host, mac]);
}
