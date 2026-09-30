/**
 * Remote access: browsers on other devices load the same UI from the main
 * window's sidecar (sidecar/remote.ts). Their host requests go to the sidecar
 * as the app's do; their Tauri calls are run by the main window (useRemoteAccess).
 */

/** Where browsers open their WebSocket. */
export const REMOTE_SOCKET = "/__ignite";

/** The `[remote]` settings the main window sends; `enabled: false` stops the server. */
export type RemoteConfig = { enabled: boolean; port: number };

/** Tauri commands a browser may have the main window run; the rest are refused. */
export const REMOTE_COMMANDS = new Set([
  "plugin:fs|read_dir",
  "plugin:fs|read_file",
  "plugin:fs|read_text_file",
  "plugin:fs|exists",
  "plugin:fs|write_text_file",
  "plugin:fs|mkdir",
  "plugin:path|resolve_directory",
  "plugin:store|load",
  "plugin:store|get",
  "plugin:store|set",
]);

/** Events passed between the app's windows and browsers, so a change shows everywhere. */
export const RELAYED_EVENTS = new Set(["settings://changed", "store://change"]);

/** A Tauri call from a browser, and its result. */
export type RemoteInvoke = {
  type: "remote_invoke";
  id: number;
  cmd: string;
  args: unknown;
  options?: { headers?: Record<string, string> };
};
export type RemoteInvokeResult =
  | { type: "remote_invoke_result"; id: number; ok: true; data: unknown }
  | { type: "remote_invoke_result"; id: number; ok: false; error: string };

export type RemoteEvent = {
  type: "remote_event";
  event: string;
  payload: unknown;
};

/** The server's state, sent to the app after each config and as browsers connect or leave. */
export type RemoteStatus = {
  type: "remote_status";
  urls: string[];
  /** The link over Tailscale, when it's connected on this machine. */
  tailscale?: string;
  error?: string;
  /** Browsers connected now. */
  devices: number;
};

/** Encodes byte arrays as `{ $bytes: base64 }` so they survive JSON. */
export function toWire(value: unknown): unknown {
  if (value instanceof ArrayBuffer) value = new Uint8Array(value);
  if (value instanceof Uint8Array) {
    let s = "";
    for (let i = 0; i < value.length; i += 0x8000) {
      s += String.fromCharCode(...value.subarray(i, i + 0x8000));
    }
    return { $bytes: btoa(s) };
  }
  return value;
}

/** Reverses toWire. */
export function fromWire(value: unknown): unknown {
  if (value && typeof value === "object" && "$bytes" in value) {
    const s = atob((value as { $bytes: string }).$bytes);
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  }
  return value;
}
