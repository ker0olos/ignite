/**
 * Chrome over the DevTools protocol: a headless Chrome the app starts with its
 * own profile, or, when asked for, the user's own once it allows remote
 * debugging (chrome://inspect's toggle, or --remote-debugging-port=9222).
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { APP_NAME } from "../src/lib/app.ts";

const USER_PORT = 9222;
// Its own port, so it never hides the user's Chrome once they allow debugging.
const OWN_PORT = 9333;

export const NO_USER_CHROME =
  "The user's Chrome doesn't allow remote debugging. Ask them to open Chrome, turn on the toggle at chrome://inspect/#remote-debugging, then try again.";

/** A CDP target, as Target.getTargets lists it. */
export type Tab = {
  targetId: string;
  type: string;
  title: string;
  url: string;
};

/** One open connection to a browser. `own`: the Chrome the app started. */
export type Cdp = {
  own: boolean;
  closed: boolean;
  /** A CDP call; `T` is its result's shape (unchecked). */
  send<T = unknown>(
    method: string,
    params?: object,
    sessionId?: string,
  ): Promise<T>;
};

type Pending = { resolve(value: unknown): void; reject(error: Error): void };

// Extensions load afresh for every session, and Chrome asks "Allow remote
// debugging?" per connection, so all sessions share one (per kind).
const KEY = Symbol.for(`${APP_NAME}.chrome`);
const OWN_KEY = Symbol.for(`${APP_NAME}.chrome.own`);
const shared = globalThis as { [key: symbol]: Promise<Cdp> | undefined };

/**
 * The shared connection, opened (or Chrome started) on first use: the app's
 * own Chrome, or the user's with `user`.
 */
export function chrome(user = false): Promise<Cdp> {
  const key = user ? KEY : OWN_KEY;
  const current = shared[key];
  const live = current?.then((cdp) => !cdp.closed).catch(() => false);
  const next = (live ?? Promise.resolve(false)).then((ok) =>
    ok ? current! : user ? attachUser() : attachOwn(),
  );
  shared[key] = next;
  return next;
}

/**
 * The browser endpoint listening on `port`, or null when nothing is. The
 * inspect toggle serves only the bare browser socket; /json/version 404s.
 */
export async function endpointOn(port: number): Promise<string | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return `ws://127.0.0.1:${port}/devtools/browser`;
    const { webSocketDebuggerUrl } = (await res.json()) as {
      webSocketDebuggerUrl: string;
    };
    return webSocketDebuggerUrl;
  } catch {
    return null;
  }
}

async function attachUser(): Promise<Cdp> {
  const url = await endpointOn(USER_PORT);
  if (!url) throw new Error(NO_USER_CHROME);
  return open(url, false);
}

async function attachOwn(): Promise<Cdp> {
  return open((await endpointOn(OWN_PORT)) ?? (await launch()), true);
}

function open(url: string, own: boolean): Promise<Cdp> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map<number, Pending>();
    let next = 1;
    // The user may take a while to answer Chrome's Allow prompt.
    const timer = setTimeout(() => {
      reject(new Error("Chrome didn't allow the connection within a minute"));
      ws.close();
    }, 60_000);
    const cdp: Cdp = {
      own,
      closed: false,
      send: <T>(method: string, params: object = {}, sessionId?: string) =>
        new Promise<T>((res, rej) => {
          if (cdp.closed) return rej(new Error("Chrome closed the connection"));
          const id = next++;
          pending.set(id, { resolve: (v) => res(v as T), reject: rej });
          ws.send(JSON.stringify({ id, method, params, sessionId }));
        }),
    };
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve(cdp);
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error(`Can't reach Chrome at ${url}`));
    });
    ws.addEventListener("close", () => {
      cdp.closed = true;
      for (const p of pending.values()) {
        p.reject(new Error("Chrome closed the connection"));
      }
      pending.clear();
    });
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(String(event.data));
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.error) {
        p.reject(new Error(`${msg.error.message} (${msg.error.code})`));
      } else p.resolve(msg.result);
    });
  });
}

const BINARIES: Record<string, string[]> = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ],
  win32: [
    `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ],
};

// Chrome refuses remote debugging on its default profile, hence its own.
// Headless, so it never shows up among the user's windows or in the Dock; with
// no window to quit, it ends with the sidecar.
async function launch(): Promise<string> {
  const binary = (BINARIES[process.platform] ?? []).find((b) => existsSync(b));
  if (!binary) throw new Error("Chrome isn't installed");
  const child = spawn(
    binary,
    [
      `--remote-debugging-port=${OWN_PORT}`,
      `--user-data-dir=${join(homedir(), `.${APP_NAME}`, "chrome")}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--headless",
      "--window-size=1280,800",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  child.unref();
  process.once("exit", () => child.kill());
  for (let i = 0; i < 75; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const url = await endpointOn(OWN_PORT);
    if (url) return url;
  }
  throw new Error("Chrome started but never opened its debugging port");
}

/** The front window's active tab URL in the user's Chrome (macOS only). */
function activeUrl(): string | null {
  if (process.platform !== "darwin") return null;
  try {
    return execFileSync(
      "osascript",
      [
        "-e",
        'tell application "Google Chrome" to get URL of active tab of front window',
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 },
    ).trim();
  } catch {
    return null;
  }
}

/** Page tabs, without DevTools windows. */
export const pages = (targets: Tab[]) =>
  targets.filter((t) => t.type === "page" && !t.url.startsWith("devtools://"));

/** The tab `hint` names (id, or part of its title or URL), else the active one, else the first. */
export function pickTab(
  tabs: Tab[],
  hint?: string,
  active?: string | null,
): Tab {
  if (!tabs.length) throw new Error("Chrome has no open tabs");
  if (!hint) return tabs.find((t) => t.url === active) ?? tabs[0];
  const tab = tabs.find(
    (t) =>
      t.targetId === hint || t.url.includes(hint) || t.title.includes(hint),
  );
  if (!tab) throw new Error(`No tab matches "${hint}"`);
  return tab;
}

/** Runs `work` attached to a tab (never one in `skip`), then detaches; `user` as for chrome(). */
export async function withTab<T>(
  hint: string | undefined,
  work: (cdp: Cdp, sessionId: string, tab: Tab) => Promise<T>,
  user = false,
  skip?: ReadonlySet<string>,
): Promise<T> {
  const cdp = await chrome(user);
  const { targetInfos } = await cdp.send<{ targetInfos: Tab[] }>(
    "Target.getTargets",
  );
  const tabs = pages(targetInfos).filter((t) => !skip?.has(t.targetId));
  // osascript would name the user's Chrome even when this is the app's.
  const tab = pickTab(tabs, hint, cdp.own ? null : activeUrl());
  const { sessionId } = await cdp.send<{ sessionId: string }>(
    "Target.attachToTarget",
    {
      targetId: tab.targetId,
      flatten: true,
    },
  );
  try {
    return await work(cdp, sessionId, tab);
  } finally {
    await cdp.send("Target.detachFromTarget", { sessionId }).catch(() => {});
  }
}
