// Serves a version's built frontend on the port the app loads. Once a mod
// changes it serves Vite instead (hot reload, as in dev), and tells pages
// loaded from the build to reload (src/lib/liveReload.ts).
import { spawn } from "node:child_process";
import { createReadStream, statSync, watch } from "node:fs";
import http from "node:http";
import net from "node:net";
import { basename, extname, join, normalize } from "node:path";
import { modsHash, SKIP, viteEnv } from "../sidecar/appBuild.ts";

const VITE_PORT = 1421;
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
};
// Paths without a file extension are the app's own routes: its page.
function serveFile(dist, req, res) {
  let file = join(dist, "index.html");
  try {
    const path = normalize(
      decodeURIComponent(new URL(req.url, "http://x").pathname),
    );
    if (extname(path)) file = join(dist, path);
  } catch {
    return res.writeHead(400).end();
  }
  if (
    !file.startsWith(dist) ||
    !statSync(file, { throwIfNoEntry: false })?.isFile()
  )
    return res.writeHead(404).end();
  res.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
  });
  createReadStream(file).pipe(res);
}

function proxy(req, res) {
  const options = {
    port: VITE_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };
  const upstream = http.request(options, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  upstream.on("error", () => res.writeHead(502).end());
  req.pipe(upstream);
}

// Vite's hot reload socket.
function proxyUpgrade(req, socket, head) {
  const upstream = net.connect(VITE_PORT, "localhost", () => {
    const headers = [];
    for (let i = 0; i < req.rawHeaders.length; i += 2)
      headers.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    upstream.write(
      `${req.method} ${req.url} HTTP/1.1\r\n${headers.join("\r\n")}\r\n\r\n`,
    );
    upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
}

function serving(port) {
  return new Promise((resolve) => {
    http
      .get({ port, path: "/" }, (r) => resolve(r.resume() && true))
      .on("error", () => resolve(false));
  });
}

async function waitServing(port, seconds, child) {
  for (let i = 0; i < seconds * 4 && child.exitCode === null; i++) {
    if (await serving(port)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/** Whether something already answers on `port` (Ignite in dev mode). */
export const portTaken = (port) => serving(port);

/**
 * Serves `dist` (built for the mods its name hashes) on `port`, and Vite from
 * the version `dir` once `mods` differ from those (none when mods are off).
 * Returns its close().
 */
export async function serveFrontend({ dist, dir, mods, port, logFd, log }) {
  const pages = new Set();
  let vite = null;
  let live = false;

  async function goLive() {
    if (vite) return;
    log("A mod changed: serving the frontend from Vite.");
    vite = spawn(
      process.execPath,
      [join(dir, "node_modules/vite/bin/vite.js")],
      {
        cwd: dir,
        env: {
          ...process.env,
          ...viteEnv(mods),
          IGNITE_DEV_PORT: String(VITE_PORT),
        },
        stdio: ["ignore", logFd, logFd],
      },
    );
    if (!(await waitServing(VITE_PORT, 60, vite)))
      return log("Vite didn't start.");
    live = true;
    for (const page of pages) page.write("data: reload\n\n");
  }

  const handle = (req, res) => {
    if (req.url !== "/__ignite/live")
      return live ? proxy(req, res) : serveFile(dist, req, res);
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    });
    if (live) res.write("data: reload\n\n");
    pages.add(res);
    req.on("close", () => pages.delete(res));
  };
  // Both loopbacks, as Vite answered "localhost" on either; never the network.
  const servers = ["127.0.0.1", "::1"].map((host) => {
    const server = http.createServer(handle);
    server.on("upgrade", (req, socket, head) =>
      live ? proxyUpgrade(req, socket, head) : socket.destroy(),
    );
    return new Promise((resolve) => {
      server.once(
        "error",
        (e) => (log(`${host}:${port}: ${e.message}`), resolve(null)),
      );
      server.listen(port, host, () => resolve(server));
    });
  });
  const listening = (await Promise.all(servers)).filter(Boolean);
  // Events alone aren't changes: FSEvents also reports the folder's own creation.
  const built = basename(dist).slice("dist-".length);
  let pending = null;
  const changed = () =>
    modsHash(mods)
      .then((hash) => hash !== built && goLive())
      .catch((error) => log(error.message));
  const watcher = mods
    ? watch(mods, { recursive: true }, (_event, file) => {
        if (vite || (file && SKIP.test(file))) return;
        clearTimeout(pending);
        pending = setTimeout(changed, 300);
      })
    : null;

  return () => {
    clearTimeout(pending);
    watcher?.close();
    vite?.kill();
    for (const server of listening) {
      server.closeAllConnections();
      server.close();
    }
  };
}
