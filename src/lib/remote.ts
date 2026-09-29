import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import {
  fromWire,
  RELAYED_EVENTS,
  REMOTE_COMMANDS,
  REMOTE_SOCKET,
  toWire,
  type RemoteEvent,
  type RemoteInvokeResult,
} from "../../shared/remote";
import type { Transport } from "./piHost";

type Internals = {
  invoke(cmd: string, args?: unknown, options?: unknown): Promise<unknown>;
};
declare global {
  interface Window {
    __TAURI_INTERNALS__?: Internals;
  }
}

let socket: WebSocket | null = null;

/** True in a browser using remote access rather than the app's own window. */
export const isRemote = () => socket !== null;

const lineListeners = new Set<(message: { id?: number }) => void>();
const invokes = new Map<number, (r: RemoteInvokeResult) => void>();
let nextInvoke = 1;
let transports = 0;
let opened: Promise<void>;

const write = (message: unknown) =>
  opened.then(() => socket!.send(JSON.stringify(message)));

// Each host client numbers requests from 1; its own range keeps replies apart.
const ID_RANGE = 1e9;

/**
 * The sidecar's protocol over the page's WebSocket (see piHost's Transport).
 * Several can share it (StrictMode mounts twice); killing one leaves it open.
 */
export function remoteTransport(): Transport {
  const base = ++transports * ID_RANGE;
  let listener: ((message: { id?: number }) => void) | null = null;
  return {
    write: (line) => {
      const message = JSON.parse(line);
      if ("id" in message) message.id += base;
      return write(message);
    },
    onLine: (cb) => {
      listener = (message) => {
        const { id } = message;
        if (id === undefined) return cb(JSON.stringify(message));
        if (id > base && id < base + ID_RANGE) {
          cb(JSON.stringify({ ...message, id: id - base }));
        }
      };
      lineListeners.add(listener);
    },
    onClose: (cb) =>
      socket!.addEventListener("close", () =>
        cb("Lost the connection to the app."),
      ),
    kill: async () => void (listener && lineListeners.delete(listener)),
  };
}

function remoteInvoke(cmd: string, args: unknown, options?: unknown) {
  const id = nextInvoke++;
  return new Promise((resolve, reject) => {
    invokes.set(id, (r) =>
      r.ok ? resolve(fromWire(r.data)) : reject(new Error(r.error)),
    );
    void write({ type: "remote_invoke", id, cmd, args: toWire(args), options });
  });
}

// The page reloads once the app is back (it restarted, or the Mac woke); a new link's 401 page too.
function reloadWhenBack() {
  setInterval(() => {
    fetch("/", { method: "HEAD" })
      .then((r) => r.status < 500 && location.reload())
      .catch(() => {});
  }, 3000);
}

/**
 * Outside Tauri, stands in for it: allowed calls (REMOTE_COMMANDS) run in the
 * app's main window, links open in a tab, and window, menu and dialog calls do nothing.
 */
export function installRemote() {
  if (window.__TAURI_INTERNALS__) return;
  socket = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${REMOTE_SOCKET}`,
  );
  opened = new Promise((resolve) =>
    socket!.addEventListener("open", () => resolve()),
  );
  socket.addEventListener("close", reloadWhenBack);
  mockWindows("remote");
  mockIPC(
    (cmd, args) => {
      if (cmd === "plugin:opener|open_url") {
        window.open((args as { url: string }).url, "_blank");
      }
      return null;
    },
    { shouldMockEvents: true },
  );
  const local = window.__TAURI_INTERNALS__!.invoke;
  const emitHere = (event: string, payload: unknown) =>
    local("plugin:event|emit", { event, payload });

  window.__TAURI_INTERNALS__!.invoke = (cmd, args, options) => {
    if (REMOTE_COMMANDS.has(cmd)) return remoteInvoke(cmd, args, options);
    const { event, payload } = (args ?? {}) as Omit<RemoteEvent, "type">;
    if (cmd === "plugin:event|emit" && RELAYED_EVENTS.has(event)) {
      void write({ type: "remote_event", event, payload });
    }
    return local(cmd, args, options);
  };

  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.type === "remote_invoke_result") {
      invokes.get(message.id)?.(message);
      invokes.delete(message.id);
    } else if (message.type === "remote_event") {
      void emitHere(message.event, message.payload);
    } else {
      lineListeners.forEach((cb) => cb(message));
    }
  });
}
