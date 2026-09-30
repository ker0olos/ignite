import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
} from "node:http";
import { connect, type Socket } from "node:net";
import { networkInterfaces } from "node:os";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { REMOTE_SOCKET } from "../shared/remote.ts";

// ponytail: the UI comes from the Vite dev server `tauri dev` runs; a built app would serve dist/
const VITE = { host: "localhost", port: 1420 };
/** Whether a WebSocket comes from this page, not another site open in the same browser. */
export function allowed(req: IncomingMessage) {
  const origin = req.headers.origin;
  return (
    URL.canParse(origin ?? "") && new URL(origin!).host === req.headers.host
  );
}

// Tailscale gives each device an address in 100.64.0.0/10.
const isTailscale = (address: string) => {
  const [a, b] = address.split(".").map(Number);
  return a === 100 && b >= 64 && b < 128;
};

/** Links other devices can open: on the local network, and over Tailscale when it's connected. */
export function remoteUrls(port: number) {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a!.address);
  const url = (address: string) => `http://${address}:${port}/`;
  const tailscale = addresses.find(isTailscale);
  return {
    urls: addresses.filter((a) => !isTailscale(a)).map(url),
    ...(tailscale && { tailscale: url(tailscale) }),
  };
}

/**
 * Serves the UI to any browser that reaches `port`: everything is proxied to
 * Vite, except REMOTE_SOCKET, handed to `onSocket`.
 */
export function startServer(
  port: number,
  onSocket: (ws: WebSocket) => void,
): Promise<{ close(): Promise<void> }> {
  const wss = new WebSocketServer({ noServer: true });
  const server = createServer((req, res) => {
    const upstream = httpRequest(
      { ...VITE, path: req.url, method: req.method, headers: viteHeaders(req) },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => res.writeHead(502).end());
    req.pipe(upstream);
  });
  server.on("upgrade", (req, socket, head) => {
    if (!allowed(req)) return void socket.destroy();
    if (req.url === REMOTE_SOCKET) {
      wss.handleUpgrade(req, socket, head, onSocket);
    } else {
      proxyUpgrade(req, socket, head);
    }
  });
  // close() alone waits for keep-alive and proxied sockets, which never end.
  const sockets = new Set<Socket>();
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  const close = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
      sockets.forEach((s) => s.destroy());
    });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => resolve({ close }));
  });
}

// Vite only answers its own host name.
function viteHeaders(req: IncomingMessage) {
  const headers = { ...req.headers };
  delete headers.cookie;
  return {
    ...headers,
    host: `${VITE.host}:${VITE.port}`,
    origin: `http://${VITE.host}:${VITE.port}`,
  };
}

// Vite's hot reload socket, passed through as raw bytes.
function proxyUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
  const up = connect(VITE.port, VITE.host, () => {
    const headers = Object.entries(viteHeaders(req))
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`);
    up.write(head);
    up.pipe(socket).pipe(up);
  });
  up.on("error", () => socket.destroy());
  socket.on("error", () => up.destroy());
}
