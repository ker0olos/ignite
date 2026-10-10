import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostClient } from "@/lib/piHost";
import { childTabId } from "@/lib/childTabs";
import { useTerminalShortcut } from "./useTerminalShortcut";

const press = (init: KeyboardEventInit) => {
  const e = new KeyboardEvent("keydown", {
    code: "Digit1",
    cancelable: true,
    ...init,
  });
  window.dispatchEvent(e);
  return e;
};

function setup(view: "conversation" | "tasks" = "conversation") {
  const request = vi.fn((r: { type: string }) =>
    Promise.resolve(
      r.type === "terminal_open"
        ? { terminal: "t1", cwd: "/w", running: true }
        : undefined,
    ),
  );
  const host = { request } as unknown as HostClient;
  const open = vi.fn();
  const hook = renderHook(() =>
    useTerminalShortcut(host, "/w", view, { open }),
  );
  return { request, open, ...hook };
}

describe("useTerminalShortcut", () => {
  it("opens a terminal tab on ⌘1, also with Shift or Ctrl", async () => {
    const { request, open } = setup();
    const e = press({ metaKey: true });
    expect(e.defaultPrevented).toBe(true);
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(request).toHaveBeenCalledWith({
      type: "terminal_open",
      cwd: "/w",
      cols: 80,
      rows: 24,
    });
    expect(open).toHaveBeenCalledWith(
      childTabId({ kind: "terminal", session: "", terminal: "t1" }),
    );
    press({ metaKey: true, shiftKey: true });
    press({ ctrlKey: true });
    await waitFor(() => expect(open).toHaveBeenCalledTimes(3));
  });

  it("ignores other keys, Alt, and a bare 1", () => {
    const { request } = setup();
    press({});
    press({ metaKey: true, altKey: true });
    press({ metaKey: true, code: "Digit2" });
    expect(request).not.toHaveBeenCalled();
  });

  it("runs a command in a new terminal tab", async () => {
    const { request, open, result } = setup();
    result.current!("echo hi\necho bye");
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith({
        type: "terminal_input",
        terminal: "t1",
        data: "{\recho hi\recho bye\r}\r",
      }),
    );
    expect(open).toHaveBeenCalledWith(
      childTabId({ kind: "terminal", session: "", terminal: "t1" }),
    );
  });

  it("has nothing to run with no sidecar", () => {
    const { result } = renderHook(() =>
      useTerminalShortcut(null, "/w", "conversation", { open: vi.fn() }),
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
