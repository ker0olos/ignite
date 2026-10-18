import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostMessage } from "../../shared/hostProtocol";
import type { Lesson, Proposal } from "../../shared/lessons";
import type { HostClient } from "@/lib/piHost";
import { useLessonProposals } from "./useLessonProposals";
import { useLessons } from "./useLessons";

const proposal: Proposal = {
  kind: "lesson",
  id: "p1",
  text: "Never force-push",
  level: "tool_call",
  tool: "git",
  folderOnly: true,
  evidence: "denied",
};

const lesson: Lesson = {
  id: "l1",
  text: "Run tests",
  level: "system_prompt",
  hits: 0,
};

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
  return Object.assign(host, { emit });
}

describe("useLessonProposals", () => {
  it("loads the conversation's proposals and applies its pushes only", async () => {
    const host = fakeHost(async () => [proposal]);
    const { result } = renderHook(() => useLessonProposals(host, "c1"));
    await waitFor(() => expect(result.current.lessons).toHaveLength(1));
    host.emit({ type: "lesson_proposals", session: "c2", lessons: [] });
    expect(result.current.lessons).toHaveLength(1);
    host.emit({ type: "lesson_proposals", session: "c1", lessons: [] });
    expect(result.current.lessons).toEqual([]);
  });

  it("answers one, showing what's left or what went wrong", async () => {
    let fail = false;
    const host = fakeHost(async (r) => {
      if (r.type === "lesson_answer" && fail)
        throw new Error("30 lessons already");
      return r.type === "lesson_proposals" ? [proposal] : [];
    });
    const { result } = renderHook(() => useLessonProposals(host, "c1"));
    await waitFor(() => expect(result.current.lessons).toHaveLength(1));
    fail = true;
    await act(() => result.current.answer("p1", true));
    expect(result.current.error).toBe("30 lessons already");
    fail = false;
    await act(() => result.current.answer("p1", true));
    expect(result.current.error).toBeNull();
    expect(result.current.lessons).toEqual([]);
    expect(host.request).toHaveBeenLastCalledWith({
      type: "lesson_answer",
      session: "c1",
      lesson: "p1",
      keep: true,
    });
  });

  it("shows nothing and asks nothing without a host or a conversation", async () => {
    const { result } = renderHook(() => useLessonProposals(null, "c1"));
    await act(() => result.current.answer("p1", false));
    expect(result.current.lessons).toEqual([]);
    const host = fakeHost(async () => [proposal]);
    renderHook(() => useLessonProposals(host, null));
    expect(host.request).not.toHaveBeenCalled();
  });

  it("ignores a failed load", async () => {
    const host = fakeHost(async () => {
      throw new Error("closed");
    });
    const { result } = renderHook(() => useLessonProposals(host, "c1"));
    await waitFor(() => expect(host.request).toHaveBeenCalled());
    expect(result.current.lessons).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});

describe("useLessons", () => {
  it("lists lessons while open, and removes one", async () => {
    const host = fakeHost(async (r) =>
      r.type === "lessons_list" ? [lesson] : [],
    );
    const { result, rerender } = renderHook(
      ({ open }) => useLessons(host, open),
      {
        initialProps: { open: false },
      },
    );
    expect(host.request).not.toHaveBeenCalled();
    rerender({ open: true });
    await waitFor(() => expect(result.current.lessons).toEqual([lesson]));
    await act(() => result.current.remove("l1"));
    expect(result.current.lessons).toEqual([]);
  });

  it("reports a failed list or removal until one succeeds", async () => {
    let fail = true;
    const host = fakeHost(async () => {
      if (fail) throw new Error("unreadable");
      return [lesson];
    });
    const { result, rerender } = renderHook(
      ({ open }) => useLessons(host, open),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(result.current.error).toBe("unreadable"));
    await act(() => result.current.remove("l1"));
    expect(result.current.error).toBe("unreadable");
    fail = false;
    await act(() => result.current.remove("l1"));
    expect(result.current.error).toBeNull();
    fail = true;
    await act(() => result.current.remove("l1"));
    rerender({ open: false });
    fail = false;
    rerender({ open: true });
    await waitFor(() => expect(result.current.error).toBeNull());
    const { result: none } = renderHook(() => useLessons(null, true));
    await act(() => none.current.remove("l1"));
    expect(none.current.lessons).toBeNull();
  });
});
