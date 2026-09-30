// @vitest-environment node
import {
  createEventBus,
  type ExtensionAPI,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import type { Task, TaskUpdate } from "../shared/tasks.ts";
import { ASKING, AUTONOMOUS } from "./askExtension.ts";
import tasks, {
  TASK_EVENT,
  PLAN_FIRST,
  TASK_GUIDANCE,
  CHROME_GUIDANCE,
  WRAP_UP,
  askTask,
  progressText,
  type TaskAsk,
} from "./taskExtension.ts";

const task: Task = {
  id: "t",
  title: "T",
  notes: "",
  images: [],
  subtasks: [
    { title: "a", status: "done" },
    { title: "b", status: "working" },
  ],
  created: 1,
  updated: 1,
};

describe("progressText", () => {
  it("numbers subtasks with their status", () => {
    expect(progressText(task)).toBe("1. [done] a\n2. [working] b");
  });

  it("says so when there are none", () => {
    expect(progressText({ ...task, subtasks: [] })).toBe(
      "Updated. The task has no subtasks.",
    );
  });
});

type Handler = (event: object, ctx?: object) => Promise<unknown>;

function load(first: Task | null, active = ["read", "ask_user"]) {
  let mine = first;
  const sent: [string, object][] = [];
  const events = createEventBus();
  const handlers = new Map<string, Handler>();
  let tool: ToolDefinition | undefined;
  tasks({
    on: (name: string, h: Handler) => handlers.set(name, h),
    registerTool: (t: ToolDefinition) => (tool = t),
    getActiveTools: () => active,
    setActiveTools: (names: string[]) => (active = names),
    sendUserMessage: (text: string, options: object) =>
      sent.push([text, options]),
    events,
  } as unknown as ExtensionAPI);
  const asks: { kind: string; update?: TaskUpdate }[] = [];
  events.on(TASK_EVENT, (data) => {
    const ask = data as TaskAsk;
    asks.push(ask);
    ask.heard = true;
    ask.reply(mine);
  });
  const start = (prompt = "do it") =>
    handlers.get("before_agent_start")!({
      prompt,
      systemPrompt: `Base\n\n${ASKING}`,
    }) as Promise<{ systemPrompt: string } | undefined>;
  const run = (params: object) =>
    tool!.execute("t1", params as never, undefined, undefined, {} as never);
  const call = (toolName: string, input: object) =>
    handlers.get("tool_call")!({ toolName, input }, { cwd: "/w" });
  const end = (stopReason?: string) =>
    handlers.get("agent_end")!({ messages: [{ stopReason }] });
  return {
    asks,
    sent,
    start,
    run,
    call,
    end,
    set: (next: Task | null) => (mine = next),
    active: () => active,
  };
}

describe("askTask", () => {
  it("resolves null at once when nobody listens", async () => {
    const events = createEventBus();
    expect(await askTask({ events }, "get")).toBeNull();
  });
});

describe("task_update", () => {
  it("passes on only the subtask, status and add it defines", async () => {
    const { asks, run } = load(task);
    await run({
      subtask: 2,
      status: "done",
      add: ["c"],
      pr: "https://evil/pull/1",
      step: "x",
    });
    expect(asks.at(-1)).toMatchObject({
      kind: "update",
      update: { subtask: 2, status: "done", add: ["c"], planned: true },
    });
    expect(Object.keys(asks.at(-1)!.update!).sort()).toEqual([
      "add",
      "planned",
      "status",
      "subtask",
    ]);
  });
});

describe("tool_call", () => {
  it("reports a task's step from each tool call", async () => {
    const { asks, call } = load(task);
    await call("read", { path: "/w/a.ts" });
    await vi.waitFor(() =>
      expect(asks).toMatchObject([
        { kind: "get" },
        { kind: "update", update: { step: "Reading a.ts" } },
      ]),
    );
  });

  it("reports nothing for a conversation without a task", async () => {
    const { asks, start, call } = load(null);
    await start();
    await call("read", { path: "/w/a.ts" });
    expect(asks.map((a) => a.kind)).toEqual(["get"]);
  });

  it("blocks file changes until the task is planned", async () => {
    const { call, set, asks } = load(task);
    const blocked = { block: true, reason: PLAN_FIRST };
    expect(await call("edit", { path: "a.ts" })).toEqual(blocked);
    expect(await call("write", { path: "a.ts" })).toEqual(blocked);
    expect(await call("read", { path: "a.ts" })).toBeUndefined();
    set({ ...task, planned: true });
    expect(await call("edit", { path: "a.ts" })).toBeUndefined();
    expect(await call("write", { path: "a.ts" })).toBeUndefined();
    await vi.waitFor(() =>
      expect(asks).toContainEqual(
        expect.objectContaining({
          kind: "update",
          update: { step: "Editing a.ts" },
        }),
      ),
    );
  });

  it("never blocks a conversation without a task", async () => {
    const { call } = load(null);
    expect(await call("edit", { path: "a.ts" })).toBeUndefined();
  });
});

describe("agent_end", () => {
  const nudge = [WRAP_UP, { deliverAs: "followUp" }];
  const finished: Task = {
    ...task,
    subtasks: [{ title: "a", status: "done" }],
    pr: "https://x/pull/1",
  };

  it("nudges an unfinished task once, until a new run starts", async () => {
    const { start, end, sent } = load(task);
    await start();
    await end("stop");
    expect(sent).toEqual([nudge]);
    await end("stop");
    expect(sent).toHaveLength(1);
    await start(WRAP_UP);
    await end("stop");
    expect(sent).toHaveLength(1);
    await start("something else");
    await end("stop");
    expect(sent).toEqual([nudge, nudge]);
  });

  it("leaves a finished task alone", async () => {
    const { start, end, sent } = load(finished);
    await start();
    await end("stop");
    expect(sent).toEqual([]);
  });

  it("doesn't nudge after a stopped or failed run", async () => {
    const { start, end, sent } = load(task);
    await start();
    await end("aborted");
    await end("error");
    expect(sent).toEqual([]);
  });

  it("doesn't nudge after the user declined the pull request", async () => {
    const { start, end, sent, set } = load(task);
    await start();
    set({ ...task, declined: true });
    await end("stop");
    expect(sent).toEqual([]);
  });

  it("doesn't nudge a conversation without a task", async () => {
    const { start, end, sent } = load(null);
    await start();
    await end("stop");
    expect(sent).toEqual([]);
  });
});

describe("task tool", () => {
  it("emits the update and returns the progress", async () => {
    const { asks, run } = load(task);
    const result = await run({ subtask: 2, status: "done" });
    expect(asks).toMatchObject([
      {
        kind: "update",
        update: { subtask: 2, status: "done", planned: true },
      },
    ]);
    expect(result.content).toEqual([
      { type: "text", text: "1. [done] a\n2. [working] b" },
    ]);
  });

  it("says the conversation has no task", async () => {
    const result = await load(null).run({ add: ["x"] });
    expect(result.content).toEqual([
      { type: "text", text: "This conversation has no task." },
    ]);
  });
});

describe("before_agent_start", () => {
  it("swaps ask_user for the task tool and goes autonomous", async () => {
    const { start, active } = load(task);
    const result = await start();
    expect(result!.systemPrompt).toBe(
      `Base\n\n${AUTONOMOUS}\n\n${TASK_GUIDANCE}`,
    );
    expect(active()).toEqual(["read", "task_update"]);
    await start();
    expect(active()).toEqual(["read", "task_update"]);
  });

  it("keeps the Chrome tools, and explains them only when they're on", async () => {
    const withChrome = ["read", "chrome_tabs", "chrome_navigate"];
    const mine = load(task, [...withChrome]);
    const result = await mine.start();
    expect(mine.active()).toEqual([...withChrome, "task_update"]);
    expect(result!.systemPrompt).toBe(
      `Base\n\n${AUTONOMOUS}\n\n${TASK_GUIDANCE}\n${CHROME_GUIDANCE}`,
    );
  });

  it("clears a declined pull request when the agent runs again", async () => {
    const { start, asks } = load({ ...task, declined: true });
    await start("Use a flame icon");
    expect(asks).toContainEqual(
      expect.objectContaining({ kind: "update", update: { declined: false } }),
    );
    const fresh = load(task);
    await fresh.start();
    expect(fresh.asks.map((a) => a.kind)).toEqual(["get"]);
  });

  it("removes the task tool and changes nothing without a task", async () => {
    const { start, active } = load(null, ["read", "ask_user", "task_update"]);
    expect(await start()).toBeUndefined();
    expect(active()).toEqual(["read", "ask_user"]);
  });
});
