import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { useAppMenu } from "./useAppMenu";

const { setAppMenu, confirmBeforeClose, confirmQuit } = vi.hoisted(() => ({
  setAppMenu: vi.fn(),
  confirmBeforeClose: vi.fn(),
  confirmQuit: vi.fn(),
}));

vi.mock("@/lib/menu", () => ({ setAppMenu }));
vi.mock("@/lib/lifecycle", () => ({ confirmBeforeClose, confirmQuit }));

type Call = { cmd: string; args: Record<string, unknown> };
type Props = Parameters<typeof useAppMenu>[0];

/** Fakes the path and window plugins used to read the home dir and focus state. */
function fakeBackend({
  home = "/Users/tester",
  focused = false,
  mockEvents = false,
}: { home?: string; focused?: boolean; mockEvents?: boolean } = {}) {
  const calls: Call[] = [];
  mockWindows("main");
  mockIPC(
    (cmd, args) => {
      calls.push({ cmd, args: args as Record<string, unknown> });
      if (cmd === "plugin:path|resolve_directory") return home;
      if (cmd === "plugin:window|is_focused") return focused;
      return null;
    },
    { shouldMockEvents: mockEvents },
  );
  return calls;
}

function props(overrides: Partial<Props> = {}): Props {
  return {
    loaded: true,
    folders: [],
    openFolder: vi.fn(),
    addFolder: vi.fn(),
    closeFolder: vi.fn(),
    clearFolders: vi.fn(),
    openSettings: vi.fn(),
    active: null,
    closeTab: vi.fn(),
    ...overrides,
  };
}

/**
 * Renders useAppMenu fresh against a faked backend. The hook reads the
 * current window at import time, so it is imported after the fakes are set up.
 */
async function setup(
  overrides: Partial<Props> = {},
  {
    focused = true,
    home = "/Users/tester",
    mockEvents = false,
  }: { focused?: boolean; home?: string; mockEvents?: boolean } = {},
) {
  vi.clearAllMocks();
  vi.resetModules();
  const unlisten = vi.fn();
  confirmBeforeClose.mockResolvedValue(unlisten);
  const calls = fakeBackend({ home, focused, mockEvents });
  const { useAppMenu: hook } = await import("./useAppMenu");
  const rendered = renderHook((p: Props) => hook(p), {
    initialProps: props(overrides),
  });
  await waitFor(() => expect(rendered.result.current.home).toBe(home));
  return { ...rendered, calls, unlisten, home };
}

/** Waits for setAppMenu's latest call to reflect the resolved home dir. */
async function latestHandlers(home: string) {
  await waitFor(() => {
    const handlers = setAppMenu.mock.calls.at(-1)?.[0];
    expect(handlers?.label(home)).toBe("~");
  });
  return setAppMenu.mock.calls.at(-1)![0];
}

describe("useAppMenu", () => {
  it("reads the home dir and returns it as home", async () => {
    const { result } = await setup({}, { home: "/Users/alice" });
    expect(result.current.home).toBe("/Users/alice");
  });

  it("installs the close confirmation on mount and removes it and the focus listener on unmount", async () => {
    const { unmount, calls, unlisten } = await setup();
    expect(confirmBeforeClose).toHaveBeenCalledOnce();
    expect(calls.filter((c) => c.cmd === "plugin:event|listen")).toHaveLength(
      2,
    );

    unmount();

    await waitFor(() => expect(unlisten).toHaveBeenCalledOnce());
    expect(calls.filter((c) => c.cmd === "plugin:event|unlisten")).toHaveLength(
      2,
    );
  });

  it("sets the menu once the window gains focus", async () => {
    const { home } = await setup({}, { focused: false, mockEvents: true });
    expect(setAppMenu).not.toHaveBeenCalled();

    await act(() => emit("tauri://focus"));

    await latestHandlers(home);
  });

  it("does not set the menu while unfocused", async () => {
    await setup({}, { focused: false });
    expect(setAppMenu).not.toHaveBeenCalled();
  });

  it("does not set the menu until loaded, then sets it once focused too", async () => {
    const { rerender } = await setup({ loaded: false }, { focused: true });
    expect(setAppMenu).not.toHaveBeenCalled();

    rerender(props({ loaded: true }));
    await waitFor(() => expect(setAppMenu).toHaveBeenCalled());
  });

  it("tildifies the label with the home dir", async () => {
    const { home } = await setup();
    const handlers = await latestHandlers(home);
    expect(handlers.label(`${home}/project`)).toBe("~/project");
    expect(handlers.label("/other/path")).toBe("/other/path");
  });

  it("closes the active tab when one is open", async () => {
    const closeTab = vi.fn();
    const { home } = await setup({ active: "/a/file.ts", closeTab });
    const handlers = await latestHandlers(home);
    handlers.closeTab();
    expect(closeTab).toHaveBeenCalledWith("/a/file.ts");
  });

  it("closes the window when no tab is open", async () => {
    const { home, calls } = await setup({ active: null });
    const handlers = await latestHandlers(home);
    const before = calls.length;
    handlers.closeTab();
    expect(
      calls.slice(before).some((c) => c.cmd === "plugin:window|close"),
    ).toBe(true);
  });

  it("closes the window from closeWindow", async () => {
    const { home, calls } = await setup();
    const handlers = await latestHandlers(home);
    const before = calls.length;
    handlers.closeWindow();
    expect(
      calls.slice(before).some((c) => c.cmd === "plugin:window|close"),
    ).toBe(true);
  });

  it("wires quit to confirmQuit", async () => {
    const { home } = await setup();
    const handlers = await latestHandlers(home);
    expect(handlers.quit).toBe(confirmQuit);
  });

  it("wires selectFolder to addFolder", async () => {
    const addFolder = vi.fn();
    const { home } = await setup({ addFolder });
    const handlers = await latestHandlers(home);
    expect(handlers.selectFolder).toBe(addFolder);
  });

  it("re-sets the menu when a dependency like active changes", async () => {
    const { home, rerender } = await setup({ active: null });
    await latestHandlers(home);
    const before = setAppMenu.mock.calls.length;

    rerender(props({ active: "/a/file.ts" }));

    await waitFor(() =>
      expect(setAppMenu.mock.calls.length).toBeGreaterThan(before),
    );
  });
});
