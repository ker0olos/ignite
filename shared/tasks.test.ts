import { describe, expect, it } from "vitest";
import { applyUpdate, prUrl, unfinished, type Task } from "./tasks.ts";

const task: Task = {
  id: "t",
  title: "T",
  notes: "",
  images: [],
  subtasks: [
    { title: "a", status: "todo" },
    { title: "b", status: "todo" },
  ],
  created: 1,
  updated: 1,
  step: "old",
};

describe("applyUpdate", () => {
  it("sets one subtask's status and stamps the time", () => {
    const next = applyUpdate(task, { subtask: 2, status: "done" }, 9);
    expect(next.subtasks.map((s) => s.status)).toEqual(["todo", "done"]);
    expect(next).toMatchObject({ updated: 9, created: 1, step: "old" });
    expect(task.subtasks[1].status).toBe("todo");
  });

  it("ignores out-of-range subtasks and a subtask without a status", () => {
    expect(
      applyUpdate(task, { subtask: 3, status: "done" }, 2).subtasks,
    ).toEqual(task.subtasks);
    expect(applyUpdate(task, { subtask: 1 }, 2).subtasks).toEqual(
      task.subtasks,
    );
  });

  it("appends trimmed subtasks and skips blank ones", () => {
    const next = applyUpdate(task, { add: [" c ", "  ", ""] }, 2);
    expect(next.subtasks.at(-1)).toEqual({ title: "c", status: "todo" });
    expect(next.subtasks).toHaveLength(3);
  });

  it("sets a trimmed step, and clears it with an empty one", () => {
    expect(applyUpdate(task, { step: " Writing " }, 2).step).toBe("Writing");
    expect(applyUpdate(task, { step: "" }, 2).step).toBe("");
    expect(applyUpdate(task, {}, 2).step).toBe("old");
  });

  it("sets planned and pr, and leaves them when absent", () => {
    const next = applyUpdate(
      task,
      { planned: true, pr: "https://x/pull/1" },
      2,
    );
    expect(next).toMatchObject({ planned: true, pr: "https://x/pull/1" });
    const kept = applyUpdate(next, { step: "s" }, 3);
    expect(kept).toMatchObject({ planned: true, pr: "https://x/pull/1" });
  });
});

describe("unfinished", () => {
  const done = task.subtasks.map((s) => ({ ...s, status: "done" as const }));
  const pr = "https://x/pull/1";

  it("is true without a pull request", () => {
    expect(unfinished({ ...task, subtasks: done })).toBe(true);
  });

  it("is true while a subtask isn't done", () => {
    expect(unfinished({ ...task, pr })).toBe(true);
  });

  it("is false with a pull request and every subtask done", () => {
    expect(unfinished({ ...task, subtasks: done, pr })).toBe(false);
    expect(unfinished({ ...task, subtasks: [], pr })).toBe(false);
  });
});

describe("prUrl", () => {
  it("finds the first pull request URL", () => {
    expect(
      prUrl("Creating...\nhttps://github.com/a/b/pull/41\nhttps://x/pull/2"),
    ).toBe("https://github.com/a/b/pull/41");
  });

  it("is null without one", () => {
    expect(prUrl("https://github.com/a/b/issues/3")).toBeNull();
    expect(prUrl("")).toBeNull();
  });
});
