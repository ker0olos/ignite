import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostClient } from "@/lib/piHost";
import { childTabId } from "@/lib/childTabs";
import { useTerminalShortcut } from "./useTerminalShortcut";

// Its tabs' lifecycle is useTerminalTabs', tested on its own.
vi.mock("@/hooks/useTerminalTabs", () => ({ useTerminalTabs: vi.fn() }));

const press = (init: KeyboardEventInit) => {
  const e = new KeyboardEvent("keydown", {
    code: "Digit1",
    cancelable: true,
    ...init,
  });
  window.dispatchEvent(e);
  return e;
};

function setup(shown: string | null = "s1", view: "chat" | "tasks" = "chat") {
  const request = vi.fn((r: { type: string }) =>
    Promise.resolve(
      r.type === "terminal_open"
        ? { terminal: "t1", cwd: "/w", running: true }
        : undefined,
    ),
  );
  const host = { request } as unknown as HostClient;
  const open = vi.fn();
  const hook = renderHook(
    ({ files }) =>
      useTerminalShortcut(host, "/w", shown, view, { files, open }),
    { initialProps: { files: [] as string[] } },
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
      childTabId({ kind: "terminal", session: "s1", terminal: "t1" }),
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

  it("opens one in a new chat, before its first message starts it", async () => {
    const { open } = setup(null);
    press({ metaKey: true });
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        childTabId({ kind: "terminal", session: "", terminal: "t1" }),
      ),
    );
  });

  it("does nothing on the Tasks view", () => {
    const { request } = setup("s1", "tasks");
    const e = press({ metaKey: true });
    expect(e.defaultPrevented).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
