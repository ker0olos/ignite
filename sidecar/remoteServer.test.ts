// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const address = (a: string, internal = false) => ({
  address: a,
  family: "IPv4",
  internal,
});

vi.mock("node:os", () => ({
  networkInterfaces: () => ({
    lo0: [address("127.0.0.1", true)],
    en0: [address("192.168.1.2"), { ...address("fe80::1"), family: "IPv6" }],
    utun4: [address("100.101.102.103")],
    bridge0: [address("100.200.0.1")],
  }),
}));

const { remoteUrls } = await import("./remoteServer.ts");

describe("remoteUrls", () => {
  it("lists network links, with Tailscale's 100.64/10 address apart", () => {
    expect(remoteUrls(4280)).toEqual({
      urls: ["http://192.168.1.2:4280/", "http://100.200.0.1:4280/"],
      tailscale: "http://100.101.102.103:4280/",
    });
  });
});
