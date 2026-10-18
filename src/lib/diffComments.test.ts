import { describe, expect, it, vi } from "vitest";
import {
  addDiffComment,
  clearDiffComments,
  diffComments,
  editDiffComment,
  removeDiffComment,
  subscribeDiffComments,
} from "@/lib/diffComments";

const base = {
  diff: { repo: "/repo", range: "HEAD", status: "M" as const },
  path: "a.ts",
  from: 0,
  to: 0,
  lines: [],
};

describe("diff comments", () => {
  it("adds, edits and deletes a conversation's comments, telling listeners", () => {
    const listener = vi.fn();
    const stop = subscribeDiffComments(listener);
    const id = addDiffComment("s-edit", { ...base, text: "First" });
    expect(diffComments("s-edit")).toMatchObject([{ id, text: "First" }]);

    editDiffComment("s-edit", id, "Changed");
    expect(diffComments("s-edit")[0].text).toBe("Changed");

    removeDiffComment("s-edit", id);
    expect(diffComments("s-edit")).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(3);
    stop();
    addDiffComment("s-edit", { ...base, text: "Unheard" });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("keeps each conversation's apart, a new conversation's under null", () => {
    addDiffComment("s-one", { ...base, text: "One" });
    addDiffComment(null, { ...base, text: "New" });
    expect(diffComments("s-one").map((c) => c.text)).toEqual(["One"]);
    expect(diffComments(null).map((c) => c.text)).toEqual(["New"]);
    expect(diffComments("s-none")).toEqual([]);
  });

  it("returns the same list until something changes", () => {
    addDiffComment("s-same", { ...base, text: "x" });
    expect(diffComments("s-same")).toBe(diffComments("s-same"));
  });

  it("clears the sent comments and keeps one added since", () => {
    addDiffComment("s-clear", { ...base, text: "Sent" });
    const sent = diffComments("s-clear");
    addDiffComment("s-clear", { ...base, text: "Later" });
    clearDiffComments("s-clear", sent);
    expect(diffComments("s-clear").map((c) => c.text)).toEqual(["Later"]);
  });
});
