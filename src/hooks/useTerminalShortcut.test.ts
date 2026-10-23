import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HostClient } from "@/lib/piHost";
import { childTabId, isStarting, terminalOf } from "@/lib/childTabs";
import { useTerminalShortcut } from "./useTerminalShortcut";

const press = (init: KeyboardEventInit) => {
  const e = new KeyboardEvent("keydown", {
    code: "KeyJ",
    key: "j",
    cancelable: true,
    ...init,
  });
  window.dispatchEvent(e);
  return e;
};

function setup(view: "conversation" | "tasks" = "conversation", fails = false) {
  const request = vi.fn((r: { type: string }) =>
    fails
      ? Promise.reject(new Error("no shell"))
      : Promise.resolve(
          r.type === "terminal_open"
            ? { terminal: "t1", cwd: "/w", running: true }
            : undefined,
        ),
  );
  const host = { request } as unknown as HostClient;
  const open = vi.fn();
  const rename = vi.fn();
  const closeEverywhere = vi.fn();
  let open_ = true;
  const isOpen = vi.fn(() => open_);
  const hook = renderHook(() =>
    useTerminalShortcut(host, "/w", "/wt", "s1", view, {
      open,
      rename,
      closeEverywhere,
      isOpen,
    }),
  );
  const closeStandIn = () => (open_ = false);
  return { request, open, rename, closeEverywhere, closeStandIn, ...hook };
}

beforeEach(() => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mac");
});

describe("useTerminalShortcut", () => {
  it("opens a terminal tab on ⌘J or ⌘T, also with Shift or another layout: starting at once, then the shell's", async () => {
    const { request, open, rename } = setup();
    const e = press({ metaKey: true });
    expect(e.defaultPrevented).toBe(true);
    const standIn = open.mock.calls[0][0] as string;
    expect(isStarting(terminalOf(standIn)!)).toBe(true);
    await waitFor(() => expect(rename).toHaveBeenCalledTimes(1));
    expect(request).toHaveBeenCalledWith({
      type: "terminal_open",
      cwd: "/w",
      dir: "/wt",
      session: "s1",
      cols: 80,
      rows: 24,
    });
    expect(rename).toHaveBeenCalledWith(
      standIn,
      childTabId({ kind: "terminal", session: "", terminal: "t1" }),
    );
    press({ metaKey: true, shiftKey: true });
    press({ metaKey: true, code: "KeyT", key: "t" });
    // Dvorak: J is on another key.
    press({ metaKey: true, code: "KeyC", key: "j" });
    // Russian: T's key types "е".
    press({ metaKey: true, code: "KeyT", key: "е" });
    expect(new Set(open.mock.calls.map(([t]) => t)).size).toBe(5);
    await waitFor(() => expect(rename).toHaveBeenCalledTimes(5));
  });

  it("ends the shell, and runs nothing, when its starting tab was closed meanwhile", async () => {
    const { request, rename, closeStandIn, result } = setup();
    closeStandIn();
    result.current!("echo hi");
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith({
        type: "terminal_close",
        terminal: "t1",
      }),
    );
    expect(rename).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "terminal_input" }),
    );
  });

  it("drops the starting tab when the shell can't start", async () => {
    const { open, closeEverywhere } = setup("conversation", true);
    press({ metaKey: true });
    await waitFor(() =>
      expect(closeEverywhere).toHaveBeenCalledWith(open.mock.calls[0][0]),
    );
  });

  it("ignores other keys, Alt, a bare J, and Ctrl on macOS (the shell's)", () => {
    const { request } = setup();
    press({});
    press({ ctrlKey: true, code: "KeyT", key: "t" });
    press({ metaKey: true, altKey: true });
    press({ metaKey: true, code: "Backquote", key: "`" });
    press({ metaKey: true, code: "KeyJ", key: "h" });
    press({ metaKey: true, code: "Digit1", key: "1" });
    expect(request).not.toHaveBeenCalled();
  });

  it("runs a command in a new terminal tab", async () => {
    const { request, rename, result } = setup();
    result.current!("echo hi\necho bye");
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith({
        type: "terminal_input",
        terminal: "t1",
        data: "{\recho hi\recho bye\r}\r",
      }),
    );
    expect(rename).toHaveBeenCalledWith(
      expect.any(String),
      childTabId({ kind: "terminal", session: "", terminal: "t1" }),
    );
  });

  it("has nothing to run with no sidecar", () => {
    const { result } = renderHook(() =>
      useTerminalShortcut(null, "/w", "/w", null, "conversation", {
        open: vi.fn(),
        rename: vi.fn(),
        closeEverywhere: vi.fn(),
        isOpen: vi.fn(),
      }),
    );
    expect(result.current).toBe(null);
  });

  it("does nothing on the Tasks view", () => {
    const { request } = setup("tasks");
    const e = press({ metaKey: true });
    expect(e.defaultPrevented).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
