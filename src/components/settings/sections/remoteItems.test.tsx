import { describe, expect, it, vi } from "vitest";
import type { RemoteStatus } from "../../../../shared/remote";
import { remoteItems } from "./remoteItems";
import { DEFAULT_SETTINGS } from "@/lib/settings";

const on = {
  ...DEFAULT_SETTINGS,
  remote: { enabled: true, port: 4280 },
};
const titles = (status: Parameters<typeof remoteItems>[0]["status"]) =>
  remoteItems({ settings: on, onChange: vi.fn(), status }).map((i) => i.title);

describe("remoteItems", () => {
  it("shows only the switch and port while off", () => {
    const rows = remoteItems({
      settings: DEFAULT_SETTINGS,
      onChange: vi.fn(),
      status: null,
    });
    expect(rows.map((i) => i.title)).toEqual(["Remote access", "Port"]);
  });

  it("offers the network link to scan or copy", () => {
    const rows = remoteItems({
      settings: on,
      onChange: vi.fn(),
      status: {
        type: "remote_status",
        urls: ["http://192.168.1.2:4280/"],
        devices: 0,
      },
    });
    expect(rows.map((i) => i.title)).toEqual(["Remote access", "Port", "Link"]);
    expect(rows[2].description).toContain("192.168.1.2:4280");
  });

  it("adds the Tailscale link only when Tailscale is connected", () => {
    const rows = remoteItems({
      settings: on,
      onChange: vi.fn(),
      status: {
        type: "remote_status",
        urls: ["http://192.168.1.2:4280/"],
        tailscale: "http://100.101.102.103:4280/",
        devices: 0,
      },
    });
    expect(rows.at(-1)?.title).toBe("Tailscale");
    expect(rows.at(-1)?.description).toContain("100.101.102.103:4280");
  });

  it("says why there's no link", () => {
    const error: RemoteStatus = {
      type: "remote_status",
      urls: [],
      error: "EADDRINUSE",
      devices: 0,
    };
    const rows = remoteItems({
      settings: on,
      onChange: vi.fn(),
      status: error,
    });
    expect(rows.find((i) => i.title === "Link")?.description).toBe(
      "EADDRINUSE",
    );
    expect(titles(null)).toContain("Link");
  });
});
