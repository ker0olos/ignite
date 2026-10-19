import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TerminalInfo } from "../../shared/terminal";
import { childTabId } from "@/lib/childTabs";
import type { HostClient } from "@/lib/piHost";
import { confirmCloseTerminal } from "@/lib/lifecycle";
import { useTerminalTabs } from "./useTerminalTabs";

vi.mock("@/lib/lifecycle", () => ({ confirmCloseTerminal: vi.fn() }));
const confirm = vi.mocked(confirmCloseTerminal);
beforeEach(() => confirm.mockReset());

const tab = (terminal: string) =>
  childTabId({ kind: "terminal", session: "", terminal });

function setup(
  listed: Record<string, TerminalInfo[]> = {},
  files: string[] = [],
  folders = ["/a", "/broken"],
) {
  let listener: (m: { type: string }) => void = () => {};
  // The sidecar finds only t1 idle.
  const request = vi.fn(
    (r: { type: string; cwd?: string; terminal?: string }) =>
      r.type === "terminal_list" && r.cwd === "/broken"
        ? Promise.reject(new Error("gone"))
        : Promise.resolve(
            r.type === "terminal_list"
              ? (listed[r.cwd ?? ""] ?? [])
              : r.type === "terminal_close_idle"
                ? r.terminal === "t1"
                : undefined,
          ),
  );
  const subscribe = vi.fn((cb: typeof listener) => {
    listener = cb;
    return () => {};
  });
  const host = { request, subscribe } as unknown as HostClient;
  const close = vi.fn();
  const closeEverywhere = vi.fn();
  const hook = renderHook(
    ({ files }) =>
      useTerminalTabs(host, folders, {
        files,
        close,
        closeEverywhere,
      }),
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
    closeEverywhere,
    closed,
    emit: (m: { type: string }) => listener(m),
    ...hook,
  };
}

describe("useTerminalTabs", () => {
  it("lists running terminals and keeps a shell whose tab closes", async () => {
    const listed = {
      "/a": [{ terminal: "t1", name: "t1", cwd: "/a", running: true }],
    };
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
      "/a": [
        { terminal: "t2", name: "t2", cwd: "/a", running: false, exitCode: 0 },
      ],
    };
    const { rerender, closed, request, emit } = setup(listed, [tab("t2")]);
    act(() => emit({ type: "terminal_exit" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(4));
    expect(closed()).toEqual([]);
    act(() => rerender({ files: [] }));
    await waitFor(() => expect(closed()).toContain("t2"));
  });

  it("closes a terminal's tabs once its folder stops listing it, never one no listing has had", async () => {
    const running = (terminal: string) => ({
      terminal,
      name: terminal,
      cwd: "/a",
      running: true,
    });
    const listed = { "/a": [running("t1"), running("t9")] };
    const shown = [tab("t1"), tab("t9"), tab("t7"), "/a/x.ts"];
    const { result, emit, closeEverywhere } = setup(listed, shown, ["/a"]);
    await waitFor(() =>
      expect(result.current.running("/a")).toEqual(["t1", "t9"]),
    );
    expect(closeEverywhere).not.toHaveBeenCalled();
    listed["/a"] = [running("t1")];
    act(() => emit({ type: "terminal_exit" }));
    await waitFor(() =>
      expect(closeEverywhere).toHaveBeenCalledWith(tab("t9")),
    );
    expect(closeEverywhere).toHaveBeenCalledTimes(1);
  });

  it("names each terminal's running command, listed then pushed", async () => {
    const listed = {
      "/a": [
        {
          terminal: "t1",
          name: "t1",
          cwd: "/a",
          running: true,
          command: "vite",
        },
      ],
    };
    const { result, emit } = setup(listed);
    await waitFor(() =>
      expect(result.current.label("t1").command).toBe("vite"),
    );
    act(() => emit({ type: "terminal_command", terminal: "t1" } as never));
    expect(result.current.label("t1").command).toBeUndefined();
    act(() =>
      emit({
        type: "terminal_command",
        terminal: "t1",
        command: "npm run dev",
      } as never),
    );
    expect(result.current.label("t1").command).toBe("npm run dev");
    // A listing taken before the push doesn't undo it.
    act(() => emit({ type: "terminal_exit" }));
    await waitFor(() => expect(result.current.running("/a")).toEqual(["t1"]));
    expect(result.current.label("t1").command).toBe("npm run dev");
  });

  it("closes an idle terminal with its tab, in every conversation, without asking", async () => {
    const { result, close, closeEverywhere, closed } = setup();
    await act(() => result.current.closeTab(tab("t1")));
    await act(() => result.current.closeTab("/a/x.ts"));
    expect(closeEverywhere.mock.calls).toEqual([[tab("t1")]]);
    expect(close.mock.calls).toEqual([["/a/x.ts"]]);
    expect(confirm).not.toHaveBeenCalled();
    // The sidecar's idle check already closed it.
    expect(closed()).toEqual([]);
  });

  it("asks before closing a terminal a command runs in", async () => {
    const listed = {
      "/a": [
        {
          terminal: "t2",
          name: "t2",
          cwd: "/a",
          running: true,
          command: "npm run dev",
        },
      ],
    };
    const { result, closeEverywhere, closed } = setup(listed);
    await waitFor(() => expect(result.current.running("/a")).toEqual(["t2"]));
    confirm.mockResolvedValue(false);
    await act(() => result.current.closeTab(tab("t2")));
    expect(confirm).toHaveBeenCalledWith("npm run dev");
    expect(closeEverywhere).not.toHaveBeenCalled();
    expect(closed()).toEqual([]);
    confirm.mockResolvedValue(true);
    await act(() => result.current.closeTab(tab("t2")));
    expect(closeEverywhere).toHaveBeenCalledWith(tab("t2"));
    expect(closed()).toEqual(["t2"]);
    expect(result.current.running("/a")).toEqual([]);
  });

  it("stop ends the shell, closes its tab and drops its row", async () => {
    const listed = {
      "/a": [{ terminal: "t1", name: "t1", cwd: "/a", running: true }],
    };
    const { result, rerender, closeEverywhere, closed } = setup(listed);
    rerender({ files: ["/a/x.ts", tab("t1")] });
    await waitFor(() => expect(result.current.running("/a")).toEqual(["t1"]));
    act(() => result.current.stop("t1"));
    expect(closeEverywhere).toHaveBeenCalledWith(tab("t1"));
    expect(closeEverywhere).toHaveBeenCalledTimes(1);
    expect(result.current.running("/a")).toEqual([]);
    expect(closed()).toEqual(["t1"]);
  });
});
