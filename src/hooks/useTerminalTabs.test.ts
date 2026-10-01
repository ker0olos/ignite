import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TerminalInfo } from "../../shared/terminal";
import { childTabId } from "@/lib/childTabs";
import type { HostClient } from "@/lib/piHost";
import { useTerminalTabs } from "./useTerminalTabs";

const tab = (terminal: string, session = "s1") =>
  childTabId({ kind: "terminal", session, terminal });

function setup(listed: Record<string, TerminalInfo[]> = {}) {
  const request = vi.fn((r: { type: string; cwd?: string }) =>
    Promise.resolve(
      r.type === "terminal_list" ? (listed[r.cwd ?? ""] ?? []) : undefined,
    ),
  );
  const host = { request } as unknown as HostClient;
  const open = vi.fn();
  const hook = renderHook(
    ({ folder, files }) => useTerminalTabs(host, folder, { files, open }),
    { initialProps: { folder: "/a", files: [] as string[] } },
  );
  const closed = () =>
    request.mock.calls
      .map(([r]) => r as { type: string; terminal?: string })
      .filter((r) => r.type === "terminal_close")
      .map((r) => r.terminal);
  return { request, open, closed, ...hook };
}

describe("useTerminalTabs", () => {
  it("ends a terminal whose tab is closed", () => {
    const { rerender, closed } = setup();
    rerender({ folder: "/a", files: ["/a/x.ts", tab("t1")] });
    expect(closed()).toEqual([]);
    act(() => rerender({ folder: "/a", files: ["/a/x.ts"] }));
    expect(closed()).toEqual(["t1"]);
  });

  it("keeps a folder's shells running while another folder shows", () => {
    const { rerender, closed } = setup();
    rerender({ folder: "/a", files: [tab("t1")] });
    act(() => rerender({ folder: "/b", files: [] }));
    act(() => rerender({ folder: "/a", files: [] }));
    expect(closed()).toEqual([]);
  });

  it("reopens the folder's running terminals and forgets exited ones", async () => {
    const { open, closed } = setup({
      "/a": [
        { terminal: "t1", cwd: "/a", running: true },
        { terminal: "t2", cwd: "/a", running: false, exitCode: 0 },
      ],
    });
    await waitFor(() => expect(open).toHaveBeenCalledWith(tab("t1", "")));
    expect(open).toHaveBeenCalledTimes(1);
    expect(closed()).toEqual(["t2"]);
  });
});
