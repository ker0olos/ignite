// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { Task } from "../shared/tasks.ts";
import { answerTask, startTask, taskPrompt } from "./hostTasks.ts";
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
    return {
      tasks,
      ctx: {
        tasks,
        agents: new Map(agents.map((id) => [id, {}])),
      } as unknown as HostContext,
    };
  };

  it("rejects an unknown task", async () => {
    await expect(startTask(ctx().ctx, "/a", "nope")).rejects.toThrow(
      "That task no longer exists.",
    );
  });

  it("rejects a task whose conversation is open", async () => {
    const { ctx: c, tasks } = ctx(["s1"]);
    await tasks.save("/a", task({ session: "s1" }));
    await expect(startTask(c, "/a", "t1")).rejects.toThrow(
      "That task is already running.",
    );
  });
});
