import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { endpointOn, pages, pickTab, type Tab } from "./chrome.ts";

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
