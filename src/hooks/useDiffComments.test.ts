import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDiffComments } from "@/hooks/useDiffComments";
import { addTextTarget } from "@/lib/composerText";
import { diffComments } from "@/lib/diffComments";
import type { DiffTab } from "@/lib/diffTabs";
import type { DiffLine } from "@/lib/toolRows";

const lines: DiffLine[] = [
  { kind: "ctx", num: 1, text: "one" },
  { kind: "add", num: 2, text: "two" },
];
const tab = (session?: string, path = "a.ts"): DiffTab => ({
  repo: "/repo",
  range: "HEAD",
  path,
  status: "M",
  session,
});

describe("useDiffComments", () => {
  it("adds, edits and deletes the tab's comments; counts the conversation's", () => {
    const here = renderHook(() =>
      useDiffComments(tab("c-crud"), { shown: "c-crud", show: vi.fn() }),
    );
    const other = renderHook(() =>
      useDiffComments(tab("c-crud", "b.ts"), {
        shown: "c-crud",
        show: vi.fn(),
      }),
    );
    act(() => void here.result.current.add(lines, 1, 0, "Both"));
    act(() => void other.result.current.add(lines, 0, 0, "Elsewhere"));
    expect(here.result.current.comments).toMatchObject([
      { text: "Both", path: "a.ts", lines: lines },
    ]);
    expect(here.result.current.count).toBe(2);

    const id = here.result.current.comments[0].id;
    act(() => here.result.current.edit(id, "Changed"));
    expect(here.result.current.comments[0].text).toBe("Changed");
    act(() => here.result.current.remove(id));
    expect(here.result.current.comments).toEqual([]);
    expect(here.result.current.count).toBe(1);
  });

  it("sends to the shown conversation's composer and clears what it sent", () => {
    const append = vi.fn();
    const remove = addTextTarget({ session: "c-send", append });
    const show = vi.fn();
    const { result } = renderHook(() =>
      useDiffComments(tab("c-send"), { shown: "c-send", show }),
    );
    act(() => void result.current.add(lines, 1, 1, "Why?"));
    act(() => result.current.send());
    expect(append).toHaveBeenCalledWith(
      "a.ts:2\n```\n2 added    two\n```\nWhy?",
    );
    expect(show).not.toHaveBeenCalled();
    expect(result.current.count).toBe(0);
    remove();
  });

  it("shows the conversation that opened the diff first, which takes the text once its composer shows", () => {
    const show = vi.fn();
    const { result } = renderHook(() =>
      useDiffComments(tab("c-other"), { shown: "c-shown", show }),
    );
    act(() => void result.current.add(lines, 0, 0, "Here"));
    act(() => result.current.send());
    expect(show).toHaveBeenCalledWith("c-other");
    expect(diffComments("c-other")).toEqual([]);

    const append = vi.fn();
    addTextTarget({ session: "c-other", append })();
    expect(append).toHaveBeenCalledWith(expect.stringContaining("\nHere"));
  });

  it("sends a tab with no conversation to the shown one, and sends nothing when empty", () => {
    const append = vi.fn();
    const remove = addTextTarget({ session: "c-any", append });
    const show = vi.fn();
    const { result } = renderHook(() =>
      useDiffComments(tab(), { shown: "c-any", show }),
    );
    act(() => result.current.send());
    expect(append).not.toHaveBeenCalled();
    act(() => void result.current.add(lines, 0, 0, "New"));
    act(() => result.current.send());
    expect(append).toHaveBeenCalledTimes(1);
    expect(show).not.toHaveBeenCalled();
    remove();
  });
});
