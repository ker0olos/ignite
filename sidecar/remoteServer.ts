import { timingSafeEqual } from "node:crypto";
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
const COOKIE = "ignite_remote";

// Byte lengths, not string lengths: timingSafeEqual throws on a mismatch.
const same = (a: string, b: string) => {
  const [x, y] = [Buffer.from(a), Buffer.from(b)];
  return x.length === y.length && timingSafeEqual(x, y);
};

// A path URL can't parse (`//[`) counts as having no token.
const tokenIn = (url = "/") =>
  URL.canParse(url, "http://x")
    ? new URL(url, "http://x").searchParams.get("token")
    : null;

const cookieOf = (req: IncomingMessage) =>
  /(?:^|;\s*)ignite_remote=([^;]+)/.exec(req.headers.cookie ?? "")?.[1] ?? "";

/** Whether a browser has the token (in its cookie); a WebSocket must also come from this page. */
export function allowed(req: IncomingMessage, token: string, socket = false) {
  if (!same(cookieOf(req), token)) return false;
  if (!socket) return true;
  const origin = req.headers.origin;
  return (
    URL.canParse(origin ?? "") && new URL(origin!).host === req.headers.host
  );
}

/** This machine's addresses other devices on the network can open. */
export function remoteUrls(port: number, token: string) {
  return Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => `http://${a!.address}:${port}/?token=${token}`);
}

const DENIED =
  "<!doctype html><meta name=viewport content='width=device-width'><p style='font:16px system-ui;padding:24px'>Open this page from the link or QR code in Ignite's Settings.</p>";

/**
 * Serves the UI to browsers holding the token: `?token=` sets the cookie,
 * then everything is proxied to Vite, except REMOTE_SOCKET, handed to `onSocket`.
 */
export function startServer(
  port: number,
  token: string,
  onSocket: (ws: WebSocket) => void,
): Promise<{ close(): Promise<void> }> {
  const wss = new WebSocketServer({ noServer: true });
  const server = createServer((req, res) => {
    // The link's token lets the page in and sets the cookie; no redirect, since
    // a phone opening it from the camera is cross-site and would drop the cookie.
    const given = tokenIn(req.url);
    if (given !== null ? !same(given, token) : !allowed(req, token)) {
      return void res.writeHead(401).end(DENIED);
    }
    if (given !== null) {
      res.setHeader(
        "set-cookie",
        `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
      );
    }
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
    if (!allowed(req, token, true)) return void socket.destroy();
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

// Vite only answers its own host name, and never needs the token.
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
