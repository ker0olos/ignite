import type { WebSocket } from "ws";
import type { HostMessage, HostRequest } from "../shared/hostProtocol.ts";
import {
  RELAYED_EVENTS,
  type RemoteConfig,
  type RemoteEvent,
  type RemoteInvoke,
  type RemoteInvokeResult,
  type RemoteStatus,
} from "../shared/remote.ts";
import { remoteUrls, startServer } from "./remoteServer.ts";

type FromApp =
  | { type: "remote_config"; config: RemoteConfig }
  | RemoteInvokeResult
  | RemoteEvent;
type FromBrowser = HostRequest | RemoteInvoke | RemoteEvent;
type ToApp = RemoteInvoke | RemoteEvent | RemoteStatus;

// Browsers' request ids are renumbered above the app's, so replies find their way back.
const FIRST_ID = 2 ** 40;

/**
 * Lets browsers share this sidecar with the app: their host requests are
 * handled like the app's, their Tauri calls go to the app, and every message
 * the host sends reaches them all.
 */
export function createRemote(
  handle: (request: HostRequest) => Promise<void>,
  toApp: (message: ToApp) => void,
  log: (message: string) => void,
) {
  const browsers = new Set<WebSocket>();
  const replies = new Map<number, { ws: WebSocket; id: number }>();
  let nextId = FIRST_ID;
  let server: Awaited<ReturnType<typeof startServer>> | null = null;
  // Changes apply one at a time, so a quick second one can't race the first.
  let configuring = Promise.resolve();
  let running = "";

  const write = (ws: WebSocket, message: unknown) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  };

  // A reply goes to the browser that asked; nothing else is addressed.
  const reply = (message: { id: number }) => {
    const to = replies.get(message.id);
    if (!to) return false;
    replies.delete(message.id);
    write(to.ws, { ...message, id: to.id });
    return true;
  };

  function fromBrowser(ws: WebSocket, message: FromBrowser) {
    // The app emits it to its windows, and back to every browser; only relayed events.
    if (message.type === "remote_event") {
      if (RELAYED_EVENTS.has(message.event)) toApp(message);
      return;
    }
    if (!("id" in message)) return void handle(message);
    const id = nextId++;
    replies.set(id, { ws, id: message.id });
    if (message.type === "remote_invoke") toApp({ ...message, id });
    else void handle({ ...message, id } as HostRequest);
  }

  function onSocket(ws: WebSocket) {
    browsers.add(ws);
    // Without a listener, a bad frame's error would throw and end the sidecar.
    ws.on("error", () => ws.terminate());
    ws.on("message", (data) => {
      try {
        fromBrowser(ws, JSON.parse(String(data)));
      } catch {
        log("remote: ignoring a message that isn't JSON");
      }
    });
    ws.on("close", () => {
      browsers.delete(ws);
      replies.forEach((to, id) => to.ws === ws && replies.delete(id));
    });
  }

  async function configure({ enabled, port, token }: RemoteConfig) {
    const wanted = enabled && token ? `${port}:${token}` : "";
    if (wanted === running) return;
    browsers.forEach((ws) => ws.close());
    await server?.close();
    server = null;
    running = "";
    if (!wanted) return toApp({ type: "remote_status", urls: [] });
    try {
      server = await startServer(port, token, onSocket);
      running = wanted;
      log(`remote access on port ${port}`);
      toApp({ type: "remote_status", urls: remoteUrls(port, token) });
    } catch (error) {
      toApp({ type: "remote_status", urls: [], error: String(error) });
    }
  }

  return {
    /** Takes the app's remote messages; false for everything else. */
    fromApp(message: HostRequest | FromApp): boolean {
      if (message.type === "remote_config") {
        configuring = configuring.then(() => configure(message.config));
      } else if (message.type === "remote_invoke_result") reply(message);
      else if (message.type === "remote_event") {
        browsers.forEach((b) => write(b, message));
      } else return false;
      return true;
    },
    /** Delivers a host message to browsers; false when it's for the app. */
    toBrowsers(message: HostMessage): boolean {
      if (message.type === "response") return reply(message);
      browsers.forEach((b) => write(b, message));
      return false;
    },
  };
}
