import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentStatus, HostMessage } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";

const plugin = vi.hoisted(() => ({
  isPermissionGranted: vi.fn(async () => true),
  requestPermission: vi.fn(async () => "granted"),
  sendNotification: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-notification", () => plugin);

import { useNotifications } from "./useNotifications";

const agent = (running: boolean): AgentStatus => ({
  cwd: "/a",
  session: "1",
  title: "Fix it",
  running,
  waiting: false,
});

function setup(enabled = true, focused = false) {
  vi.spyOn(document, "hasFocus").mockReturnValue(focused);
  const listeners = new Set<(m: HostMessage) => void>();
  const host = {
    subscribe: (cb: (m: HostMessage) => void) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
  } as unknown as HostClient;
  renderHook(() => useNotifications(host, enabled));
  return (agents: AgentStatus[]) =>
    act(() => listeners.forEach((cb) => cb({ type: "agents", agents })));
}

beforeEach(() => {
  vi.clearAllMocks();
  plugin.isPermissionGranted.mockResolvedValue(true);
});

describe("useNotifications", () => {
  it("notifies a finished run while the window isn't focused", async () => {
    const push = setup();
    push([agent(true)]);
    push([agent(false)]);
    await waitFor(() =>
      expect(plugin.sendNotification).toHaveBeenCalledWith({
        title: "Fix it · a",
        body: "Finished",
      }),
    );
  });

  it("stays quiet while focused or disabled", async () => {
    for (const [enabled, focused] of [
      [true, true],
      [false, false],
    ]) {
      const push = setup(enabled, focused);
      push([agent(true)]);
      push([agent(false)]);
    }
    await new Promise((r) => setTimeout(r, 10));
    expect(plugin.sendNotification).not.toHaveBeenCalled();
  });

  it("asks permission once, and sends nothing when denied", async () => {
    plugin.isPermissionGranted.mockResolvedValue(false);
    plugin.requestPermission.mockResolvedValue("denied");
    const push = setup();
    push([agent(true)]);
    push([agent(false)]);
    push([agent(true)]);
    push([agent(false)]);
    await waitFor(() => expect(plugin.requestPermission).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    expect(plugin.requestPermission).toHaveBeenCalledTimes(1);
    expect(plugin.sendNotification).not.toHaveBeenCalled();
  });
});
