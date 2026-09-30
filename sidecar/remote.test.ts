// @vitest-environment node
import type { IncomingMessage } from "node:http";
import { connect as connectTcp } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import type { HostMessage, HostRequest } from "../shared/hostProtocol.ts";
import { REMOTE_SOCKET } from "../shared/remote.ts";
import { createRemote } from "./remote.ts";
import { allowed } from "./remoteServer.ts";

const PORT = 40000 + Math.floor(Math.random() * 20000);
const origin = `http://localhost:${PORT}`;

const req = (headers: Record<string, string>) =>
  ({ headers: { host: `localhost:${PORT}`, ...headers } }) as IncomingMessage;

describe("allowed", () => {
  it("takes a socket only from the page itself", () => {
    expect(allowed(req({ origin }))).toBe(true);
    expect(allowed(req({ origin: "http://evil.test" }))).toBe(false);
    expect(allowed(req({ origin: "null" }))).toBe(false);
    expect(allowed(req({}))).toBe(false);
  });
});

describe("createRemote", () => {
  let remote: ReturnType<typeof createRemote>;
  const handle = vi.fn<(request: HostRequest) => Promise<void>>(async () => {});
  const toApp = vi.fn();

  const start = async (heartbeatMs?: number) => {
    remote = createRemote(handle, toApp, () => {}, heartbeatMs);
    remote.fromApp({
      type: "remote_config",
      config: { enabled: true, port: PORT },
    } as never);
    await vi.waitFor(() =>
      expect(toApp).toHaveBeenCalledWith(
        expect.objectContaining({ type: "remote_status" }),
      ),
    );
  };

  const connect = async () => {
    const ws = new WebSocket(`ws://localhost:${PORT}${REMOTE_SOCKET}`, {
      headers: { origin },
    });
    const received: unknown[] = [];
    ws.on("message", (data) => received.push(JSON.parse(String(data))));
    await new Promise((resolve, reject) => {
      ws.on("open", resolve);
      ws.on("error", reject);
    });
    return { ws, received };
  };

  afterEach(() => {
    remote?.fromApp({
      type: "remote_config",
      config: { enabled: false, port: PORT },
    } as never);
    vi.clearAllMocks();
  });

  it("serves any browser, with no token", async () => {
    await start();
    // From Vite, or 502 without it; never refused.
    const page = await fetch(`${origin}/`, { redirect: "manual" });
    expect([200, 502]).toContain(page.status);
    await expect(connect()).resolves.toBeTruthy();
  });

  it("restarts on a new port while browsers are connected", async () => {
    await start();
    await connect();
    await fetch(`${origin}/`); // a keep-alive connection
    toApp.mockClear();
    remote.fromApp({
      type: "remote_config",
      config: { enabled: true, port: PORT + 1 },
    } as never);
    await vi.waitFor(() =>
      expect(toApp).toHaveBeenLastCalledWith(
        expect.objectContaining({
          urls: expect.arrayContaining([
            expect.stringContaining(`:${PORT + 1}/`),
          ]),
        }),
      ),
    );
    await expect(connect()).rejects.toThrow();
  });

  it("tells the app how many browsers are connected as they come and go", async () => {
    await start();
    const devices = () => toApp.mock.lastCall?.[0].devices;
    expect(devices()).toBe(0);
    const a = await connect();
    await vi.waitFor(() => expect(devices()).toBe(1));
    const b = await connect();
    await vi.waitFor(() => expect(devices()).toBe(2));
    // The links stay in the status while devices come and go.
    expect(toApp.mock.lastCall?.[0].urls.length).toBeGreaterThan(0);
    a.ws.close();
    b.ws.close();
    await vi.waitFor(() => expect(devices()).toBe(0));
  });

  it("drops a browser that stops answering pings, keeping one that answers", async () => {
    await start(40);
    const live = await connect();
    const gone = await connect();
    await vi.waitFor(() => expect(toApp.mock.lastCall?.[0].devices).toBe(2));
    // A phone that went away without closing: its pongs never come.
    gone.ws.pong = () => {};
    (gone.ws as unknown as { autoPong: boolean }).autoPong = false;
    await vi.waitFor(() => expect(toApp.mock.lastCall?.[0].devices).toBe(1));
    await new Promise((r) => setTimeout(r, 150));
    expect(live.ws.readyState).toBe(WebSocket.OPEN);
    expect(toApp.mock.lastCall?.[0].devices).toBe(1);
  });

  it("answers a browser's request to that browser, under its own id", async () => {
    await start();
    const { received } = await connect();
    const other = await connect();
    // The app's own responses never reach browsers.
    expect(remote.toBrowsers({ type: "response", id: 1, ok: true })).toBe(
      false,
    );

    other.ws.send(JSON.stringify({ id: 1, type: "status" }));
    await vi.waitFor(() => expect(handle).toHaveBeenCalled());
    const sent = handle.mock.calls[0][0] as { id: number };
    expect(sent.id).toBeGreaterThan(1);
    expect(remote.toBrowsers({ type: "response", id: sent.id, ok: true })).toBe(
      true,
    );
    await vi.waitFor(() =>
      expect(other.received).toEqual([{ type: "response", id: 1, ok: true }]),
    );
    expect(received).toEqual([]);
  });

  it("sends host events to every browser and the app", async () => {
    await start();
    const a = await connect();
    const b = await connect();
    const event: HostMessage = { type: "agents", agents: [] };
    expect(remote.toBrowsers(event)).toBe(false);
    await vi.waitFor(() => {
      expect(a.received).toEqual([event]);
      expect(b.received).toEqual([event]);
    });
  });

  it("has the app run a browser's Tauri call and returns its result", async () => {
    await start();
    const { ws, received } = await connect();
    ws.send(
      JSON.stringify({
        type: "remote_invoke",
        id: 7,
        cmd: "plugin:fs|exists",
        args: { path: "/x" },
      }),
    );
    await vi.waitFor(() =>
      expect(toApp).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "remote_invoke",
          cmd: "plugin:fs|exists",
        }),
      ),
    );
    const asked = toApp.mock.calls.find(
      ([m]) => m.type === "remote_invoke",
    )![0];
    remote.fromApp({
      type: "remote_invoke_result",
      id: asked.id,
      ok: true,
      data: true,
    } as never);
    await vi.waitFor(() =>
      expect(received).toEqual([
        { type: "remote_invoke_result", id: 7, ok: true, data: true },
      ]),
    );
  });

  it("passes events from browsers to the app, and from the app to browsers", async () => {
    await start();
    const { ws, received } = await connect();
    const event = {
      type: "remote_event",
      event: "settings://changed",
      payload: 1,
    };
    ws.send(JSON.stringify(event));
    await vi.waitFor(() => expect(toApp).toHaveBeenCalledWith(event));
    expect(remote.fromApp(event as never)).toBe(true);
    await vi.waitFor(() => expect(received).toEqual([event]));
    expect(remote.fromApp({ id: 1, type: "status" })).toBe(false);
  });

  it("drops browser events that aren't relayed", async () => {
    await start();
    const { ws } = await connect();
    toApp.mockClear();
    ws.send(
      JSON.stringify({
        type: "remote_event",
        event: "app://reload",
        payload: 1,
      }),
    );
    ws.send(JSON.stringify({ id: 1, type: "status" }));
    await vi.waitFor(() => expect(handle).toHaveBeenCalled());
    expect(toApp).not.toHaveBeenCalled();
  });

  it("survives a path URL can't parse, and a bad frame", async () => {
    await start();
    const raw = await new Promise<string>((resolve) => {
      const s = connectTcp(PORT, "localhost", () =>
        s.write("GET //[ HTTP/1.1\r\nHost: x\r\n\r\n"),
      );
      s.on("data", (d) => {
        resolve(String(d));
        s.destroy();
      });
    });
    expect(raw).toMatch(/^HTTP\/1\.1 \d{3}/);
    const { ws } = await connect();
    // A text frame that isn't UTF-8 makes ws emit an error on the server's socket.
    (ws as unknown as { _socket: { write(b: Buffer): void } })._socket.write(
      Buffer.from([0x81, 0x82, 0, 0, 0, 0, 0xff, 0xfe]),
    );
    await new Promise((r) => setTimeout(r, 100));
    expect([200, 502]).toContain((await fetch(`${origin}/`)).status);
  });
});
