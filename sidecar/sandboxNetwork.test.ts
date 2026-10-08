// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hostListed, hostReachable, readsOnly } from "./sandboxNetwork.ts";
import { mayBeBlocked } from "./sandbox.ts";

describe("readsOnly", () => {
  let listed = ["github.com", "*.githubusercontent.com"];
  const filter = readsOnly(() => listed);
  const send = (method: string, url: string, headers = {}) =>
    filter(
      new Request(url, {
        method,
        headers,
        ...(method === "POST" && { body: "x=1" }),
      }),
    );

  it("treats a WebSocket's opening GET as a send", async () => {
    const upgrade = { upgrade: "websocket", connection: "Upgrade" };
    expect((await send("GET", "https://a.com/ws", upgrade)).action).toBe(
      "deny",
    );
  });

  it("reads the listed hosts on every request", async () => {
    expect((await send("POST", "http://a.com/x")).action).toBe("deny");
    listed = [...listed, "a.com"];
    expect((await send("POST", "http://a.com./x")).action).toBe("allow");
  });

  it.each(["GET", "HEAD", "OPTIONS"])("lets %s reach any host", async (m) => {
    expect((await send(m, "https://api.example.com/x")).action).toBe("allow");
  });

  it("lets anything reach listed hosts", async () => {
    expect((await send("POST", "http://github.com/x")).action).toBe("allow");
    expect(
      (await send("POST", "http://raw.githubusercontent.com/x")).action,
    ).toBe("allow");
  });

  it("denies other methods elsewhere, saying permission was denied", async () => {
    const decision = await send("POST", "https://api.example.com/x");
    expect(decision.action).toBe("deny");
    expect(mayBeBlocked(decision.reason ?? "")).toBe(true);
  });

  it("matches a wildcard's subdomains only", () => {
    expect(hostListed("a.github.com", ["*.github.com"])).toBe(true);
    expect(hostListed("github.com", ["*.github.com"])).toBe(false);
    expect(hostListed("evilgithub.com", ["*.github.com"])).toBe(false);
  });
});

describe("hostReachable", () => {
  it.each(["example.com", "api.venice.ai"])("lets %s through", async (host) => {
    expect(await hostReachable({ host })).toBe(true);
  });

  it.each([
    "127.0.0.1",
    "2130706433",
    "0x7f.1",
    "::1",
    "[::1]",
    "10.0.0.5",
    "localhost",
    "app.localhost.",
    "no-such-host.invalid",
  ])("keeps %s out", async (host) => {
    expect(await hostReachable({ host })).toBe(false);
  });
});
