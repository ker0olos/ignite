import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostMessage, McpServer } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { useMcpServers } from "./useMcpServers";

const docs: McpServer = {
  name: "docs",
  enabled: true,
  config: { type: "http", url: "https://x.dev/mcp", headers: {} },
  status: "idle",
  tools: [],
};

/** A fake sidecar client answering each request with `answer`. */
function fakeHost(answer: (req: { type: string }) => Promise<unknown>) {
  const listeners = new Set<(m: HostMessage) => void>();
  const host = {
    request: vi.fn(answer) as unknown as HostClient["request"],
    send: vi.fn(),
    subscribe: (cb: (m: HostMessage) => void) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    close: vi.fn(),
  } satisfies HostClient;
  const emit = (m: HostMessage) => act(() => listeners.forEach((cb) => cb(m)));
  return Object.assign(host, { emit, listeners });
}

describe("useMcpServers", () => {
  it("does nothing without a sidecar", () => {
    const { result } = renderHook(() => useMcpServers(null));
    expect(result.current.servers).toBeNull();
  });

  it("loads the servers and follows the sidecar's pushes", async () => {
    const host = fakeHost(async () => [docs]);
    const { result } = renderHook(() => useMcpServers(host));
    await waitFor(() => expect(result.current.servers).toEqual([docs]));
    const connected = { ...docs, status: "connected" as const };
    host.emit({ type: "mcp_servers", servers: [connected] });
    expect(result.current.servers).toEqual([connected]);
    host.emit({ type: "session_error", error: "x" });
    expect(result.current.servers).toEqual([connected]);
  });

  it("reports a list it couldn't load", async () => {
    const host = fakeHost(async () => {
      throw new Error("mcp.json isn't valid JSON.");
    });
    const { result } = renderHook(() => useMcpServers(host));
    await waitFor(() =>
      expect(result.current.error).toBe("mcp.json isn't valid JSON."),
    );
  });

  it("forgets a closed sidecar's pushes and servers", async () => {
    const first = fakeHost(async () => [docs]);
    const second = fakeHost(() => new Promise(() => {}));
    const { result, rerender } = renderHook(({ h }) => useMcpServers(h), {
      initialProps: { h: first as HostClient },
    });
    await waitFor(() => expect(result.current.servers).toEqual([docs]));
    rerender({ h: second });
    expect(result.current.servers).toBeNull();
    expect(first.listeners.size).toBe(0);
  });

  it("ignores a list that arrives after unmounting", async () => {
    let answer: (s: McpServer[]) => void = () => {};
    const host = fakeHost(() => new Promise((r) => (answer = r)));
    const { result, unmount } = renderHook(() => useMcpServers(host));
    unmount();
    await act(async () => answer([docs]));
    expect(result.current.servers).toBeNull();
  });

  it("saves a server and shows the sidecar's answer", async () => {
    const host = fakeHost(async (req) =>
      req.type === "mcp_list" ? [] : [docs],
    );
    const { result } = renderHook(() => useMcpServers(host));
    await waitFor(() => expect(result.current.servers).toEqual([]));
    let problem: string | null = "unset";
    await act(async () => {
      problem = await result.current.save("docs", docs.config, "old");
    });
    expect(problem).toBeNull();
    expect(host.request).toHaveBeenCalledWith({
      type: "mcp_save",
      name: "docs",
      config: docs.config,
      previousName: "old",
    });
    expect(result.current.servers).toEqual([docs]);
  });

  it("returns a save's problem to the form, not the list", async () => {
    const host = fakeHost(async (req) => {
      if (req.type === "mcp_list") return [];
      throw new Error("Enter a command.");
    });
    const { result } = renderHook(() => useMcpServers(host));
    let problem: string | null = null;
    await act(async () => {
      problem = await result.current.save("docs", docs.config);
    });
    expect(problem).toBe("Enter a command.");
    expect(result.current.error).toBeNull();
  });

  it("can't save without a sidecar", async () => {
    const { result } = renderHook(() => useMcpServers(null));
    expect(await result.current.save("docs", docs.config)).toBe(
      "The agent host isn't running.",
    );
  });

  it.each([
    ["remove", { type: "mcp_remove", name: "docs" }],
    ["setEnabled", { type: "mcp_set_enabled", name: "docs", enabled: false }],
    ["reconnect", { type: "mcp_reconnect", name: "docs" }],
  ] as const)("sends %s and shows its result", async (action, request) => {
    const host = fakeHost(async () => [docs]);
    const { result } = renderHook(() => useMcpServers(host));
    await act(async () => {
      if (action === "setEnabled")
        await result.current.setEnabled("docs", false);
      else await result.current[action]("docs");
    });
    expect(host.request).toHaveBeenCalledWith(request);
    expect(result.current.error).toBeNull();
  });

  it("shows a failed row action until the next one succeeds", async () => {
    const reconnect = vi.fn(async () => {
      throw new Error("Turn docs on first.");
    });
    const host = fakeHost(async (req) =>
      req.type === "mcp_reconnect" ? reconnect() : [docs],
    );
    const { result } = renderHook(() => useMcpServers(host));
    await act(() => result.current.reconnect("docs"));
    expect(result.current.error).toBe("Turn docs on first.");
    await act(() => result.current.remove("docs"));
    expect(result.current.error).toBeNull();
  });
});
