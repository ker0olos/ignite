import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  fromWire,
  RELAYED_EVENTS,
  REMOTE_COMMANDS,
  toWire,
  type RemoteConfig,
  type RemoteInvoke,
  type RemoteInvokeResult,
  type RemoteStatus,
} from "../../shared/remote";
import type { HostClient } from "@/lib/piHost";
import { isRemote } from "@/lib/remote";
import type { Settings } from "@/lib/settings";

type ToSidecar =
  | RemoteInvokeResult
  | { type: "remote_event"; event: string; payload: unknown }
  | { type: "remote_config"; config: RemoteConfig };

// Remote messages aren't host requests; the sidecar takes them before the host (sidecar/remote.ts).
const post = (host: HostClient, message: ToSidecar) =>
  host.send(message as never).catch(() => {});

/** Runs a browser's Tauri call in this window, if it's one browsers may make. */
export async function answer(
  { id, cmd, args, options }: RemoteInvoke,
  run = invoke,
): Promise<RemoteInvokeResult> {
  try {
    if (!REMOTE_COMMANDS.has(cmd))
      throw new Error(`${cmd} isn't allowed remotely.`);
    const data = await run(cmd, fromWire(args) as never, options as never);
    return { type: "remote_invoke_result", id, ok: true, data: toWire(data) };
  } catch (error) {
    return {
      type: "remote_invoke_result",
      id,
      ok: false,
      error: String(error),
    };
  }
}

/**
 * In the main window: runs the remote access server as `remote` says,
 * answers browsers' calls, and passes settings and store changes both ways.
 * Returns the server's links, or why it couldn't start.
 */
export function useRemoteAccess(
  host: HostClient | null,
  { enabled, port }: Settings["remote"],
) {
  const [status, setStatus] = useState<RemoteStatus | null>(null);
  const serves = !!host && !isRemote() && getCurrentWindow().label === "main";

  useEffect(() => {
    if (!serves) return;
    const unsubscribe = host.subscribe((m) => {
      if (m.type === "remote_status") setStatus(m);
      if (m.type === "remote_invoke") void answer(m).then((r) => post(host, r));
      if (m.type === "remote_event" && RELAYED_EVENTS.has(m.event)) {
        void emit(m.event, m.payload);
      }
    });
    const unlisten = [...RELAYED_EVENTS].map((event) =>
      listen(event, ({ payload }) =>
        post(host, { type: "remote_event", event, payload }),
      ),
    );
    return () => {
      unsubscribe();
      unlisten.forEach((u) => u.then((f) => f()));
    };
  }, [serves, host]);

  useEffect(() => {
    if (serves) {
      void post(host, {
        type: "remote_config",
        config: { enabled, port },
      });
    }
  }, [serves, host, enabled, port]);

  return status;
}
