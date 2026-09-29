import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostClient } from "@/lib/piHost";
import { useConversations } from "./useConversations";

function setup(fail = false) {
  const request = vi.fn(async (r: { type: string }) => {
    if (fail) throw new Error("Gone");
    return r.type === "list_sessions"
      ? [
          { id: "a", title: "open", modified: 2, messageCount: 2, open: true },
          {
            id: "b",
            title: "closed",
            modified: 1,
            messageCount: 2,
            open: false,
          },
        ]
      : undefined;
  });
  const host = { request } as unknown as HostClient;
  const shown = {
    show: vi.fn(),
    create: vi.fn(),
    close: vi.fn(async () => {}),
  };
  const select = vi.fn();
  const forget = vi.fn();
  const dismiss = vi.fn();
  const { result } = renderHook(() =>
    useConversations(host, "/work", shown, { select, dismiss, forget }),
  );
  return { request, shown, select, dismiss, forget, result };
}

describe("useConversations", () => {
  it("handles the shown folder's conversations through its session", async () => {
    const { request, shown, select, forget, result } = setup();
    act(() => result.current.show("/work", "s2"));
    act(() => result.current.create("/work"));
    await act(() => result.current.close("/work", "s2", ["s1", "s2"]));
    expect(forget).toHaveBeenCalledWith("/work", "s2");
    expect(shown.show).toHaveBeenCalledWith("s2", "/work");
    expect(shown.create).toHaveBeenCalledWith("/work");
    expect(shown.close).toHaveBeenCalledWith("s2", ["s1", "s2"]);
    expect(request).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it("selects another folder at once to show a conversation, or a new one, in it", async () => {
    const { request, shown, select, result } = setup();
    act(() => result.current.show("/other", "s9"));
    expect(shown.show).toHaveBeenCalledWith("s9", "/other");
    expect(select).toHaveBeenLastCalledWith("/other");
    act(() => result.current.create("/other"));
    expect(shown.create).toHaveBeenCalledWith("/other");
    expect(select).toHaveBeenCalledTimes(2);
    expect(request).not.toHaveBeenCalled();
  });

  it("closes another folder's conversation in the sidecar, even if that fails", async () => {
    const { request, result } = setup(true);
    await act(() => result.current.close("/other", "s9", ["s9"]));
    expect(request).toHaveBeenCalledWith({
      type: "close_session",
      cwd: "/other",
      session: "s9",
    });
  });

  it("takes a folder off the sidebar, ending its conversations", () => {
    const { request, dismiss, result } = setup();
    act(() => result.current.dismiss("/other"));
    expect(dismiss).toHaveBeenCalledWith("/other");
    expect(request).toHaveBeenCalledWith({
      type: "close_session",
      cwd: "/other",
    });
  });

  it("lists a folder's closed conversations", async () => {
    const { result } = setup();
    expect((await result.current.history("/other")).map((s) => s.id)).toEqual([
      "b",
    ]);
  });
});
