import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDiffComments } from "@/hooks/useDiffComments";
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
  it("adds, edits and deletes the tab's comments, in the message of the conversation that opened it", () => {
    const here = renderHook(() => useDiffComments(tab("c-crud"), "c-shown"));
    const other = renderHook(() =>
      useDiffComments(tab("c-crud", "b.ts"), "c-shown"),
    );
    act(() => void here.result.current.add(lines, 1, 0, "Both"));
    act(() => void other.result.current.add(lines, 0, 0, "Elsewhere"));
    expect(here.result.current.comments).toMatchObject([
      {
        text: "Both",
        path: "a.ts",
        lines,
        diff: { repo: "/repo", range: "HEAD", status: "M", session: "c-crud" },
      },
    ]);
    expect(diffComments("c-crud").map((c) => c.text)).toEqual([
      "Both",
      "Elsewhere",
    ]);
    expect(diffComments("c-shown")).toEqual([]);

    const id = here.result.current.comments[0].id;
    act(() => here.result.current.edit(id, "Changed"));
    expect(here.result.current.comments[0].text).toBe("Changed");
    act(() => here.result.current.remove(id));
    expect(here.result.current.comments).toEqual([]);
  });

  it("puts a diff's that no conversation opened in the shown one's message", () => {
    const { result } = renderHook(() => useDiffComments(tab(), "c-any"));
    act(() => void result.current.add(lines, 0, 0, "New"));
    expect(diffComments("c-any")).toMatchObject([{ text: "New" }]);
    expect(result.current.comments).toHaveLength(1);
  });
});
