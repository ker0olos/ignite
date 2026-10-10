import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TerminalInfo } from "../../shared/terminal";
import { childTabId } from "@/lib/childTabs";
import type { HostClient } from "@/lib/piHost";
import { useTerminalTabs } from "./useTerminalTabs";

const tab = (terminal: string) =>
  childTabId({ kind: "terminal", session: "", terminal });

function setup(
  listed: Record<string, TerminalInfo[]> = {},
  files: string[] = [],
) {
  let listener: (m: { type: string }) => void = () => {};
  const request = vi.fn((r: { type: string; cwd?: string }) =>
    r.type === "terminal_list" && r.cwd === "/broken"
      ? Promise.reject(new Error("gone"))
      : Promise.resolve(
          r.type === "terminal_list" ? (listed[r.cwd ?? ""] ?? []) : undefined,
        ),
  );
  const subscribe = vi.fn((cb: typeof listener) => {
    listener = cb;
    return () => {};
  });
  const host = { request, subscribe } as unknown as HostClient;
  const close = vi.fn();
  const hook = renderHook(
    ({ files }) => useTerminalTabs(host, ["/a", "/broken"], { files, close }),
    { initialProps: { files } },
  );
  const closed = () =>
    request.mock.calls
      .map(([r]) => r as { type: string; terminal?: string })
      .filter((r) => r.type === "terminal_close")
      .map((r) => r.terminal);
  return {
    request,
    close,
    closed,
    emit: (m: { type: string }) => listener(m),
    ...hook,
  };
}

describe("useTerminalTabs", () => {
  it("lists running terminals and keeps a shell whose tab closes", async () => {
    const listed = { "/a": [{ terminal: "t1", cwd: "/a", running: true }] };
    const { result, rerender, closed } = setup(listed);
    await waitFor(() => expect(result.current.running("/a")).toEqual(["t1"]));
    expect(result.current.running("/broken")).toEqual([]);
    act(() => rerender({ files: [tab("t1")] }));
    act(() => rerender({ files: [] }));
    await waitFor(() => expect(result.current.running("/a")).toEqual(["t1"]));
    expect(closed()).toEqual([]);
  });

  it("forgets exited terminals once no tab shows them", async () => {
    const listed = {
      "/a": [{ terminal: "t2", cwd: "/a", running: false, exitCode: 0 }],
    };
    const { rerender, closed, request, emit } = setup(listed, [tab("t2")]);
    act(() => emit({ type: "terminal_exit" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(4));
    expect(closed()).toEqual([]);
    act(() => rerender({ files: [] }));
    await waitFor(() => expect(closed()).toContain("t2"));
  });

  it("stop ends the shell, closes its tab and drops its row", async () => {
    const listed = { "/a": [{ terminal: "t1", cwd: "/a", running: true }] };
    const { result, rerender, close, closed } = setup(listed);
    rerender({ files: ["/a/x.ts", tab("t1")] });
    await waitFor(() => expect(result.current.running("/a")).toEqual(["t1"]));
    act(() => result.current.stop("t1"));
    expect(close).toHaveBeenCalledWith(tab("t1"));
    expect(close).toHaveBeenCalledTimes(1);
    expect(result.current.running("/a")).toEqual([]);
    expect(closed()).toEqual(["t1"]);
  });
});
