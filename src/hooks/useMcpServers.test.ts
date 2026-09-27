import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  HostMessage,
  McpCatalog,
  McpServer,
} from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { useMcpServers } from "./useMcpServers";

const docs: McpServer = {
  name: "docs",
  enabled: true,
  config: { type: "http", url: "https://x.dev/mcp", headers: {} },
  status: "idle",
  tools: [],
};

const CATALOG: McpCatalog = {
  presets: [
    {
      id: "context7",
      name: "Context7",
      summary: "Docs.",
      signIn: false,
      added: false,
    },
  ],
  sources: [],
};

/**
 * A fake sidecar client answering each request with `answer`; catalog
 * requests get `catalog` unless `answer` handles them.
 */
function fakeHost(
  answer: (req: { type: string }) => Promise<unknown>,
  catalog: (req: { type: string }) => Promise<unknown> = async () => CATALOG,
) {
  const listeners = new Set<(m: HostMessage) => void>();
  const host = {
    request: vi.fn((req: { type: string }) =>
      req.type === "mcp_catalog" ? catalog(req) : answer(req),
    ) as unknown as HostClient["request"],
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

  it("shows problems extensions report, such as a failed sign-in", async () => {
    const host = fakeHost(async () => [docs]);
    const { result } = renderHook(() => useMcpServers(host));
    await waitFor(() => expect(result.current.servers).toEqual([docs]));
    host.emit({ type: "extension_error", message: "Sign-in was denied." });
    expect(result.current.error).toBe("Sign-in was denied.");
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
    ["signIn", { type: "mcp_sign_in", name: "docs" }],
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
    const signIn = vi.fn(async () => {
      throw new Error("Turn docs on first.");
    });
    const host = fakeHost(async (req) =>
      req.type === "mcp_sign_in" ? signIn() : [docs],
    );
    const { result } = renderHook(() => useMcpServers(host));
    await act(() => result.current.signIn("docs"));
    expect(result.current.error).toBe("Turn docs on first.");
    await act(() => result.current.remove("docs"));
    expect(result.current.error).toBeNull();
  });

  describe("catalog", () => {
    const catalogCalls = (host: HostClient) =>
      vi
        .mocked(host.request)
        .mock.calls.map(([r]) => r)
        .filter((r) => r.type === "mcp_catalog");

    it("loads what can be added, for the open folder", async () => {
      const host = fakeHost(async () => [docs]);
      const { result } = renderHook(() => useMcpServers(host, "/work"));
      await waitFor(() => expect(result.current.catalog).toEqual(CATALOG));
      expect(catalogCalls(host)).toEqual([
        { type: "mcp_catalog", cwd: "/work" },
      ]);
    });

    it("reloads when saved servers or the folder change, not on status", async () => {
      const host = fakeHost(async () => [docs]);
      const { result, rerender } = renderHook(
        ({ folder }) => useMcpServers(host, folder),
        { initialProps: { folder: null as string | null } },
      );
      await waitFor(() => expect(result.current.catalog).toEqual(CATALOG));
      expect(catalogCalls(host)).toEqual([{ type: "mcp_catalog" }]);

      host.emit({
        type: "mcp_servers",
        servers: [{ ...docs, status: "connected" }],
      });
      expect(catalogCalls(host)).toHaveLength(1);

      host.emit({
        type: "mcp_servers",
        servers: [docs, { ...docs, name: "more" }],
      });
      await waitFor(() => expect(catalogCalls(host)).toHaveLength(2));

      rerender({ folder: "/other" });
      await waitFor(() => expect(catalogCalls(host)).toHaveLength(3));
      expect(catalogCalls(host)[2]).toEqual({
        type: "mcp_catalog",
        cwd: "/other",
      });
    });

    it("reports a catalog it couldn't load", async () => {
      const host = fakeHost(
        async () => [docs],
        async () => {
          throw new Error("unreadable");
        },
      );
      const { result } = renderHook(() => useMcpServers(host));
      await waitFor(() => expect(result.current.error).toBe("unreadable"));
    });

    it("ignores a catalog that arrives after unmounting", async () => {
      let answer: (c: McpCatalog) => void = () => {};
      const host = fakeHost(
        async () => [docs],
        () => new Promise((r) => (answer = r)),
      );
      const { result, unmount } = renderHook(() => useMcpServers(host));
      await waitFor(() => expect(catalogCalls(host)).toHaveLength(1));
      unmount();
      await act(async () => answer(CATALOG));
      expect(result.current.catalog).toBeNull();
    });

    it("adds a preset and imports servers, from the open folder", async () => {
      const host = fakeHost(async () => [docs]);
      const { result } = renderHook(() => useMcpServers(host, "/work"));
      await act(() => result.current.addPreset("context7"));
      await act(() => result.current.importServers("claude-code", ["a"]));
      expect(host.request).toHaveBeenCalledWith({
        type: "mcp_add_preset",
        preset: "context7",
      });
      expect(host.request).toHaveBeenCalledWith({
        type: "mcp_import",
        source: "claude-code",
        names: ["a"],
        cwd: "/work",
      });
    });

    it("imports without a folder", async () => {
      const host = fakeHost(async () => [docs]);
      const { result } = renderHook(() => useMcpServers(host));
      await act(() => result.current.importServers("codex", ["b"]));
      expect(host.request).toHaveBeenCalledWith({
        type: "mcp_import",
        source: "codex",
        names: ["b"],
      });
    });
  });
});
