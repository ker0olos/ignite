import { describe, expect, it } from "vitest";
import {
  applyUpdate,
  autonomous,
  conversationTask,
  prUrl,
  proposedTask,
  readProposed,
  unfinished,
  type Task,
  readPlan,
} from "./tasks.ts";

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

const image = (name: string, size = 0) => ({
  type: "image" as const,
  data: "x".repeat(size),
  mimeType: "image/png",
  name,
});

describe("applyUpdate", () => {
  it("adds shown images, keeping the latest six", () => {
    let t = task;
    for (let i = 1; i <= 7; i++)
      t = applyUpdate(t, { image: image(`${i}`) }, 1);
    expect(t.shown?.map((s) => s.name)).toEqual(["2", "3", "4", "5", "6", "7"]);
    expect(applyUpdate(task, {}, 1).shown).toBeUndefined();
  });

  it("drops the oldest shown images past 8 MB, and skips one that's alone too big", () => {
    let t = applyUpdate(task, { image: image("a", 5_000_000) }, 1);
    t = applyUpdate(t, { image: image("b", 5_000_000) }, 1);
    expect(t.shown?.map((s) => s.name)).toEqual(["b"]);
    t = applyUpdate(t, { image: image("huge", 9_000_000) }, 1);
    expect(t.shown?.map((s) => s.name)).toEqual(["b"]);
  });

  it("sets subtasks' statuses and stamps the time", () => {
    const next = applyUpdate(
      task,
      {
        set: [
          { subtask: 1, status: "working" },
          { subtask: 2, status: "done" },
          { subtask: 1, status: "done" },
        ],
      },
      9,
    );
    expect(next.subtasks.map((s) => s.status)).toEqual(["done", "done"]);
    expect(next).toMatchObject({ updated: 9, created: 1, step: "old" });
    expect(task.subtasks[1].status).toBe("todo");
  });

  it("ignores out-of-range subtasks", () => {
    expect(
      applyUpdate(task, { set: [{ subtask: 3, status: "done" }] }, 2).subtasks,
    ).toEqual(task.subtasks);
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

  it("completes the task with its pull request, clearing a decline", () => {
    const declined = applyUpdate(task, { declined: true }, 2);
    expect(declined).toMatchObject({ declined: true });
    expect(declined.done).toBeUndefined();
    expect(applyUpdate(declined, { declined: false }, 3).declined).toBe(false);
    expect(applyUpdate(declined, { pr: "https://x/pull/2" }, 3)).toMatchObject({
      done: true,
      declined: false,
    });
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

  it("is false once the user declined its pull request", () => {
    expect(unfinished({ ...task, declined: true })).toBe(false);
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

describe("readProposed", () => {
  it("keeps tasks with a title", () => {
    expect(
      readProposed({ tasks: [{ title: "a" }, { title: " " }, { notes: "x" }] }),
    ).toEqual([{ title: "a" }]);
    expect(readProposed({})).toEqual([]);
  });
});

describe("proposedTask", () => {
  it("is a new task with no notes or subtasks when none are given", () => {
    expect(proposedTask({ title: "a" }, "id", 5)).toEqual({
      id: "id",
      title: "a",
      notes: "",
      images: [],
      subtasks: [],
      created: 5,
      updated: 5,
    });
  });
});

describe("autonomous", () => {
  it("holds for a task from the Tasks view, not one the user follows", () => {
    expect(autonomous(task)).toBe(true);
    expect(autonomous({ ...task, interactive: true })).toBe(false);
    expect(autonomous(null)).toBe(false);
  });
});

describe("conversationTask", () => {
  it("joins the list with the conversation, titled after it", () => {
    expect(conversationTask("s1", "Fix login", 5)).toMatchObject({
      title: "Fix login",
      session: "s1",
      interactive: true,
      subtasks: [],
      created: 5,
    });
    expect(conversationTask("s1", "", 5).title).toBe("Conversation");
  });
});

describe("readPlan", () => {
  it("reads a task_update call's subtasks, or nothing", () => {
    const result = (details: unknown) => ({ content: [], details });
    const subtasks = [{ title: "a", status: "done" }];
    expect(readPlan(result({ subtasks }))).toEqual(subtasks);
    expect(readPlan(result({ subtasks: [] }))).toBeUndefined();
    expect(readPlan(result(undefined))).toBeUndefined();
    expect(readPlan(undefined)).toBeUndefined();
  });
});
