import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_NAME } from "../src/lib/app.ts";
import {
  chrome,
  endpointOn,
  pages,
  pickTab,
  withTab,
  type Tab,
} from "./chrome.ts";

const tab = (
  targetId: string,
  title: string,
  url: string,
  type = "page",
): Tab => ({
  targetId,
  title,
  url,
  type,
});
const tabs = [
  tab("A", "Inbox", "https://mail.example.com"),
  tab("B", "Docs", "https://docs.example.com"),
];

describe("pickTab", () => {
  it("picks the tab named by id, url or title", () => {
    expect(pickTab(tabs, "B").targetId).toBe("B");
    expect(pickTab(tabs, "docs.example").targetId).toBe("B");
    expect(pickTab(tabs, "Inbox").targetId).toBe("A");
  });

  it("fails when nothing matches the hint", () => {
    expect(() => pickTab(tabs, "nope")).toThrow('No tab matches "nope"');
  });

  it("picks the active tab, else the first", () => {
    expect(pickTab(tabs, undefined, "https://docs.example.com").targetId).toBe(
      "B",
    );
    expect(pickTab(tabs, undefined, null).targetId).toBe("A");
  });

  it("fails with no tabs", () => {
    expect(() => pickTab([])).toThrow("no open tabs");
  });
});

it("pages drops workers and DevTools windows", () => {
  const all = [
    ...tabs,
    tab("W", "sw", "https://x", "service_worker"),
    tab("D", "dt", "devtools://devtools"),
  ];
  expect(pages(all).map((t) => t.targetId)).toEqual(["A", "B"]);
});

describe("chrome", () => {
  // Both the user's Chrome (9222) and the app's (9333) answer; sockets open at once.
  const fetched: string[] = [];
  const sockets: string[] = [];
  // Answers Target.getTargets with `tabs`, anything else with {sessionId}.
  class FakeSocket {
    listeners: Record<string, (event: { data: string }) => void> = {};
    constructor(url: string) {
      sockets.push(url);
    }
    addEventListener(type: string, listener: () => void) {
      this.listeners[type] = listener;
      if (type === "open") setTimeout(listener);
    }
    send(raw: string) {
      const { id, method } = JSON.parse(raw);
      const result =
        method === "Target.getTargets"
          ? { targetInfos: tabs }
          : { sessionId: "S" };
      const data = JSON.stringify({ id, result });
      setTimeout(() => this.listeners.message({ data }));
    }
  }

  beforeEach(() => {
    fetched.length = sockets.length = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      fetched.push(url);
      const port = new URL(url).port;
      return Response.json({ webSocketDebuggerUrl: `ws://browser-${port}` });
    });
    vi.stubGlobal("WebSocket", FakeSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    const shared = globalThis as Record<symbol, unknown>;
    delete shared[Symbol.for(`${APP_NAME}.chrome`)];
    delete shared[Symbol.for(`${APP_NAME}.chrome.own`)];
  });

  it("prefers the user's Chrome when it allows debugging", async () => {
    const cdp = await chrome();
    expect(cdp.own).toBe(false);
    expect(sockets).toEqual(["ws://browser-9222"]);
  });

  it("ownOnly never asks the user's Chrome, and keeps its own connection", async () => {
    const own = await chrome(true);
    expect(own.own).toBe(true);
    expect(sockets).toEqual(["ws://browser-9333"]);
    expect(fetched.some((u) => u.includes(":9222"))).toBe(false);

    expect(await chrome(true)).toBe(own);
    const user = await chrome();
    expect(user.own).toBe(false);
    expect(sockets).toEqual(["ws://browser-9333", "ws://browser-9222"]);
  });

  it("withTab never picks a skipped tab", async () => {
    const picked = (skip?: Set<string>) =>
      withTab(undefined, async (_c, _s, t) => t.targetId, true, skip);
    expect(await picked()).toBe("A");
    expect(await picked(new Set(["A"]))).toBe("B");
    await expect(
      withTab("A", async () => "", true, new Set(["A"])),
    ).rejects.toThrow('No tab matches "A"');
  });
});

describe("endpointOn", () => {
  async function serve(status: number, body = "") {
    const server = createServer((_req, res) => res.writeHead(status).end(body));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    return { server, port: (server.address() as AddressInfo).port };
  }

  it("reads the socket from /json/version (--remote-debugging-port)", async () => {
    const { server, port } = await serve(
      200,
      JSON.stringify({ webSocketDebuggerUrl: "ws://x/devtools/browser/1" }),
    );
    expect(await endpointOn(port)).toBe("ws://x/devtools/browser/1");
    server.close();
  });

  it("falls back to the bare browser socket when /json 404s (inspect toggle)", async () => {
    const { server, port } = await serve(404);
    expect(await endpointOn(port)).toBe(
      `ws://127.0.0.1:${port}/devtools/browser`,
    );
    server.close();
  });

  it("is null when nothing listens", async () => {
    const { server, port } = await serve(200);
    await new Promise((r) => server.close(r));
    expect(await endpointOn(port)).toBeNull();
  });
});
