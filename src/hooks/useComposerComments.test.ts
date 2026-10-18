import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readComments, withComments } from "../../shared/sentComments";
import { useComposerComments } from "@/hooks/useComposerComments";
import { addDiffComment, diffComments } from "@/lib/diffComments";

const line = { kind: "add" as const, num: 2, text: "two" };
const add = (session: string, text: string) =>
  addDiffComment(session, {
    diff: { repo: "/repo", range: "HEAD", status: "M" },
    path: "a.ts",
    from: 1,
    to: 1,
    lines: [line],
    text,
  });

describe("useComposerComments", () => {
  it("shows the conversation's comments, and removes one", () => {
    add("m-show", "In");
    const { result } = renderHook(() => useComposerComments("m-show"));
    expect(result.current.comments.map((c) => c.text)).toEqual(["In"]);
    act(() => result.current.remove(result.current.comments[0].id));
    expect(result.current.comments).toEqual([]);
  });

  it("adds them to the message being sent and forgets them", () => {
    add("m-take", "Rename it");
    const { result } = renderHook(() => useComposerComments("m-take"));
    let sent = "";
    act(() => void (sent = result.current.take("Look")));
    expect(readComments(sent)).toEqual({
      text: "Look",
      comments: [{ path: "a.ts", lines: [line], text: "Rename it" }],
    });
    expect(result.current.comments).toEqual([]);
    expect(diffComments("m-take")).toEqual([]);
  });

  it("sends a message without comments as it is", () => {
    const { result } = renderHook(() => useComposerComments("m-none"));
    expect(result.current.take("Hi")).toBe("Hi");
  });

  it("puts back the comments of messages taken back from the queue", () => {
    const { result } = renderHook(() => useComposerComments("m-back"));
    const queued = withComments("Look", [
      { path: "a.ts", lines: [line], text: "Again" },
    ]);
    act(() => result.current.restore([queued, "plain"]));
    expect(result.current.comments).toMatchObject([
      { path: "a.ts", text: "Again" },
    ]);
    expect(result.current.comments[0].diff).toBeUndefined();
  });
});
