import { describe, expect, it } from "vitest";
import type { Task } from "../shared/tasks.ts";
import type { TaskAsk } from "./taskExtension.ts";
import { NEEDS_TAB, NO_USER_IN_TASK, scopeOf, taskTab } from "./taskTabs.ts";

describe("taskTab", () => {
  const mine = new Set(["T1"]);

  it("allows a tab the task opened, by id", () => {
    expect(taskTab("T1", mine)).toBe("T1");
  });

  it("refuses no tab, and tabs it didn't open", () => {
    expect(() => taskTab(undefined, mine)).toThrow(NEEDS_TAB);
    expect(() => taskTab("T2", mine)).toThrow(/^Tab T2 isn't one this task/);
    expect(() => taskTab("example.com", mine)).toThrow(/isn't one/);
  });
});

// A host that answers every task question with `task`.
const piWith = (task: Task | null) => ({
  events: {
    emit: (_channel: string, data: unknown) => {
      const ask = data as TaskAsk;
      ask.heard = true;
      ask.reply(task);
    },
    on: () => () => {},
  },
});

describe("scopeOf", () => {
  it("leaves a normal conversation's calls as they are, away from tasks' tabs", async () => {
    const scope = scopeOf(piWith(null));
    expect(await scope.task()).toBe(false);
    expect(await scope.at("docs")).toEqual({
      user: false,
      tab: "docs",
      skip: scope.claimed,
    });
    expect((await scope.at("docs", true)).user).toBe(true);
  });

  it("treats a conversation the user follows like a normal one", async () => {
    const scope = scopeOf(piWith({ id: "t", interactive: true } as Task));
    expect(await scope.task()).toBe(false);
    expect((await scope.at("docs", true)).user).toBe(true);
  });

  it("holds a task to the app's Chrome and its own tabs", async () => {
    const scope = scopeOf(piWith({ id: "t" } as Task));
    expect(await scope.task()).toBe(true);
    await expect(scope.at()).rejects.toThrow(NEEDS_TAB);
    await expect(scope.at("T1")).rejects.toThrow(/isn't one/);
    scope.claim("T1");
    expect(await scope.at("T1")).toEqual({ user: false, tab: "T1" });
    await expect(scope.at("T1", true)).rejects.toThrow(NO_USER_IN_TASK);
  });

  it("shares claimed tabs across sessions, but not a task's own list", () => {
    const one = scopeOf(piWith({ id: "a" } as Task));
    const two = scopeOf(piWith({ id: "b" } as Task));
    one.claim("T9");
    expect(two.claimed.has("T9")).toBe(true);
    expect(two.mine.has("T9")).toBe(false);
    expect(one.shows(true, "T9")).toBe(true);
    expect(two.shows(true, "T9")).toBe(false);
    expect(two.shows(false, "T9")).toBe(false);
    expect(two.shows(false, "other")).toBe(true);
  });
});
