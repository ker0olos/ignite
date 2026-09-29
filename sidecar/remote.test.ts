// @vitest-environment node
import type { IncomingMessage } from "node:http";
import { connect as connectTcp } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import type { HostMessage, HostRequest } from "../shared/hostProtocol.ts";
import { REMOTE_SOCKET } from "../shared/remote.ts";
import { createRemote } from "./remote.ts";
import { allowed } from "./remoteServer.ts";

const TOKEN = "secret-token";
const PORT = 40000 + Math.floor(Math.random() * 20000);
const origin = `http://localhost:${PORT}`;

const req = (headers: Record<string, string>) =>
  ({ headers: { host: `localhost:${PORT}`, ...headers } }) as IncomingMessage;

describe("allowed", () => {
  it("needs the token's cookie, and a socket from the page itself", () => {
    const cookie = `other=1; ignite_remote=${TOKEN}`;
    expect(allowed(req({ cookie }), TOKEN)).toBe(true);
    expect(allowed(req({ cookie: "ignite_remote=wrong" }), TOKEN)).toBe(false);
    expect(allowed(req({}), TOKEN)).toBe(false);
    expect(allowed(req({ cookie, origin }), TOKEN, true)).toBe(true);
    expect(
      allowed(req({ cookie, origin: "http://evil.test" }), TOKEN, true),
    ).toBe(false);
    expect(allowed(req({ cookie, origin: "null" }), TOKEN, true)).toBe(false);
  });

  it("refuses a same-length token whose bytes differ in length, without throwing", () => {
    const sneaky = "é".padEnd(TOKEN.length, "x");
    expect(sneaky.length).toBe(TOKEN.length);
    expect(allowed(req({ cookie: `ignite_remote=${sneaky}` }), TOKEN)).toBe(
      false,
    );
  });
});

describe("createRemote", () => {
  let remote: ReturnType<typeof createRemote>;
  const handle = vi.fn<(request: HostRequest) => Promise<void>>(async () => {});
  const toApp = vi.fn();

  const start = async () => {
    remote = createRemote(handle, toApp, () => {});
    remote.fromApp({
      type: "remote_config",
      config: { enabled: true, port: PORT, token: TOKEN },
    } as never);
    await vi.waitFor(() =>
      expect(toApp).toHaveBeenCalledWith(
        expect.objectContaining({ type: "remote_status" }),
      ),
    );
  };

  const connect = async (cookie = `ignite_remote=${TOKEN}`) => {
    const ws = new WebSocket(`ws://localhost:${PORT}${REMOTE_SOCKET}`, {
      headers: { cookie, origin },
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
      config: { enabled: false, port: PORT, token: "" },
    } as never);
    vi.clearAllMocks();
  });

  it("restarts with a new token while browsers are connected", async () => {
    await start();
    await connect();
    await fetch(`${origin}/`); // a keep-alive connection
    remote.fromApp({
      type: "remote_config",
      config: { enabled: true, port: PORT, token: "new-token" },
    } as never);
    await vi.waitFor(() => expect(toApp).toHaveBeenCalledTimes(2));
    await expect(connect()).rejects.toThrow();
    await expect(connect("ignite_remote=new-token")).resolves.toBeTruthy();
  });

  it("sets the cookie from the link, and refuses pages without it", async () => {
    await start();
    const denied = await fetch(`${origin}/`, { redirect: "manual" });
    expect(denied.status).toBe(401);
    const wrong = await fetch(`${origin}/?token=nope`, { redirect: "manual" });
    expect(wrong.status).toBe(401);
    // Served straight away (from Vite, or 502 without it), with the cookie; no redirect.
    const link = await fetch(`${origin}/?token=${TOKEN}`, {
      redirect: "manual",
    });
    expect([200, 502]).toContain(link.status);
    expect(link.headers.get("set-cookie")).toContain(`ignite_remote=${TOKEN}`);
    expect(link.headers.get("set-cookie")).toContain("SameSite=Lax");
    await expect(connect("ignite_remote=wrong")).rejects.toThrow();
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
    expect(raw).toContain("401");
    const { ws } = await connect();
    // A text frame that isn't UTF-8 makes ws emit an error on the server's socket.
    (ws as unknown as { _socket: { write(b: Buffer): void } })._socket.write(
      Buffer.from([0x81, 0x82, 0, 0, 0, 0, 0xff, 0xfe]),
    );
    await new Promise((r) => setTimeout(r, 100));
    expect((await fetch(`${origin}/`)).status).toBe(401);
  });
});
