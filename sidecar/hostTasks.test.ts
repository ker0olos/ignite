// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../shared/tasks.ts";
import { answerTask, deleteTask, startTask, taskPrompt } from "./hostTasks.ts";
import { close, launch, prompt } from "./hostSession.ts";
import type { HostContext } from "./hostTypes.ts";
import type { TaskAsk } from "./taskExtension.ts";
import { createTaskStore, type TaskStore } from "./taskStore.ts";

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "Fix it",
  notes: "",
  images: [],
  subtasks: [],
  created: 1,
  updated: 1,
  ...over,
});

vi.mock("./hostSession.ts", () => ({
  launch: vi.fn(async () => {}),
  prompt: vi.fn(async () => {}),
  close: vi.fn(async () => {}),
}));

beforeEach(() => vi.clearAllMocks());

describe("taskPrompt", () => {
  it("is the title alone when there is nothing else", () => {
    expect(taskPrompt(task())).toBe("Fix it");
    expect(taskPrompt(task({ notes: "  \n " }))).toBe("Fix it");
  });

  it("adds notes, numbered subtasks and image names", () => {
    const image = { type: "image" as const, data: "d", mimeType: "image/png" };
    expect(
      taskPrompt(
        task({
          notes: " Be quick ",
          subtasks: [
            { title: "One", status: "todo" },
            { title: "Two", status: "done" },
          ],
          images: [
            { ...image, name: "a.png" },
            { ...image, name: "b.png" },
          ],
        }),
      ),
    ).toBe(
      "Fix it\n\nBe quick\n\nSubtasks:\n1. One\n2. Two\n\nAttached images: a.png, b.png",
    );
  });
});

describe("answerTask", () => {
  const ask = (
    partial: { kind: "get" } | { kind: "update"; update: object },
  ) => {
    const reply = vi.fn();
    return { reply, ask: { ...partial, reply, heard: false } as TaskAsk };
  };

  it("marks the ask heard before any await", () => {
    const { ask: heard } = ask({ kind: "get" });
    void answerTask(createTaskStore(null), "/w", "s", heard);
    expect(heard.heard).toBe(true);
  });

  it("replies with the session's task, or null", async () => {
    const store = createTaskStore(null);
    await store.save("/a", task({ session: "s1" }));
    const mine = ask({ kind: "get" });
    await answerTask(store, "/a", "s1", mine.ask);
    expect(mine.reply).toHaveBeenCalledWith(task({ session: "s1" }));
    const other = ask({ kind: "get" });
    await answerTask(store, "/a", "s2", other.ask);
    expect(other.reply).toHaveBeenCalledWith(null);
  });

  it("applies an update and replies with the updated task", async () => {
    const store = createTaskStore(null);
    await store.save("/a", task({ session: "s1" }));
    const { ask: a, reply } = ask({ kind: "update", update: { step: "Go" } });
    await answerTask(store, "/a", "s1", a);
    expect(reply.mock.calls[0][0]).toMatchObject({ step: "Go" });
    expect((await store.list("/a"))[0].step).toBe("Go");
  });

  it("replies null when the store throws", async () => {
    const store = {
      list: async () => {
        throw new Error("disk");
      },
      updateBySession: async () => {
        throw new Error("disk");
      },
    } as unknown as TaskStore;
    for (const kind of ["get", "update"] as const) {
      const { ask: a, reply } = ask(
        kind === "get" ? { kind } : { kind, update: {} },
      );
      await answerTask(store, "/a", "s1", a);
      expect(reply).toHaveBeenCalledWith(null);
    }
  });
});

describe("startTask", () => {
  const ctx = (agents: string[] = []) => {
    const tasks = createTaskStore(null);
    const opening = Promise.resolve({
      modelRuntime: { getAvailable: async () => [] },
    });
    return {
      tasks,
      ctx: {
        tasks,
        starting: new Set(),
        sessions: { create: () => "s1" },
        agents: new Map(agents.map((id) => [id, { opening }])),
      } as unknown as HostContext,
    };
  };
  const setUp = () => {
    const c = ctx(["s1"]);
    return c;
  };

  it("rejects an unknown task", async () => {
    await expect(startTask(ctx().ctx, "/a", "nope")).rejects.toThrow(
      "That task no longer exists.",
    );
  });

  it("rejects a task that was already started", async () => {
    const { ctx: c, tasks } = ctx();
    await tasks.save("/a", task({ session: "s1" }));
    await expect(startTask(c, "/a", "t1")).rejects.toThrow(
      "That task was already started.",
    );
  });

  it("refuses a second start while the first is under way", async () => {
    const { ctx: c, tasks } = setUp();
    await tasks.save("/a", task());
    const first = startTask(c, "/a", "t1");
    await expect(startTask(c, "/a", "t1")).rejects.toThrow("already starting");
    await first;
    expect(launch).toHaveBeenCalledTimes(1);
    expect(c.starting.size).toBe(0);
  });

  it("resets what an earlier run left", async () => {
    const { ctx: c, tasks } = setUp();
    await tasks.save(
      "/a",
      task({
        step: "old",
        planned: true,
        pr: "https://x/pull/1",
        done: true,
        error: "boom",
        subtasks: [{ title: "One", status: "done" }],
      }),
    );
    await startTask(c, "/a", "t1");
    const [t] = await tasks.list("/a");
    expect(t.session).toBe("s1");
    expect(t.subtasks).toEqual([{ title: "One", status: "todo" }]);
    for (const key of ["step", "planned", "pr", "done", "error"] as const) {
      expect(t[key]).toBeUndefined();
    }
  });

  it("records a launch failure and lets the task start again", async () => {
    const { ctx: c, tasks } = setUp();
    await tasks.save("/a", task());
    vi.mocked(launch).mockRejectedValueOnce(new Error("no worktree"));
    await startTask(c, "/a", "t1");
    const [t] = await tasks.list("/a");
    expect(t.session).toBeUndefined();
    expect(t.error).toContain("no worktree");
    await startTask(c, "/a", "t1");
    expect((await tasks.list("/a"))[0]).toMatchObject({ session: "s1" });
    expect((await tasks.list("/a"))[0].error).toBeUndefined();
  });

  it("records a run's failure, which nobody else would report", async () => {
    const { ctx: c, tasks } = setUp();
    await tasks.save("/a", task());
    let fail: (e: unknown) => unknown = () => {};
    vi.mocked(prompt).mockImplementationOnce(async (...args) => {
      fail = args[4]!;
    });
    await startTask(c, "/a", "t1");
    await fail(new Error("no key"));
    const [t] = await tasks.list("/a");
    expect(t.session).toBeUndefined();
    expect(t.error).toContain("no key");
  });
});

describe("deleteTask", () => {
  it("ends the task's conversation, then removes it", async () => {
    const tasks = createTaskStore(null);
    await tasks.save("/a", task({ session: "s1" }));
    const left = await deleteTask(
      { tasks } as unknown as HostContext,
      "/a",
      "t1",
    );
    expect(close).toHaveBeenCalledWith(expect.anything(), "/a", "s1");
    expect(left).toEqual([]);
  });

  it("leaves conversations alone for a task never started", async () => {
    const tasks = createTaskStore(null);
    await tasks.save("/a", task());
    await deleteTask({ tasks } as unknown as HostContext, "/a", "t1");
    expect(close).not.toHaveBeenCalled();
  });
});
