import { Value } from "typebox/value";
// @vitest-environment node
import {
  createEventBus,
  type ExtensionAPI,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import type { Task, TaskUpdate } from "../shared/tasks.ts";
import { ASKING, AUTONOMOUS } from "./askExtension.ts";
import { COMMAND_GUIDANCE, TASK_COMMAND_GUIDANCE } from "./bashExtension.ts";
import tasks, {
  TASK_EVENT,
  PLAN_GUIDANCE,
  TASK_GUIDANCE,
  CHROME_GUIDANCE,
  WRAP_UP,
  askTask,
  planReminder,
  progressText,
  type TaskAsk,
} from "./taskExtension.ts";
import { PLAN_FIRST, SUBAGENT_PLAN_FIRST } from "./taskSteps.ts";

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
  const asks: { kind: string; update?: TaskUpdate; tasks?: Task[] }[] = [];
  events.on(TASK_EVENT, (data) => {
    const ask = data as TaskAsk;
    asks.push(ask);
    ask.heard = true;
    if (ask.kind === "add") mine = ask.tasks[0];
    ask.reply(mine);
  });
  const start = (prompt = "do it") =>
    handlers.get("before_agent_start")!({
      prompt,
      systemPrompt: `Base\n\n${ASKING}\n\n${COMMAND_GUIDANCE}`,
    }) as Promise<{ systemPrompt: string } | undefined>;
  const run = (params: object) =>
    tool!.execute("t1", params as never, undefined, undefined, {
      sessionManager: {
        getSessionId: () => "s1",
        getBranch: () => [
          { type: "message", message: { role: "user", content: "Fix login" } },
        ],
      },
    } as never);
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
  it("passes on only the statuses, remove and add it defines", async () => {
    const { asks, run } = load({ ...task, interactive: true });
    await run({
      set: [{ subtask: 2, status: "done" }],
      remove: [1],
      add: ["c"],
      pr: "https://evil/pull/1",
      step: "x",
    });
    expect(asks.at(-1)).toMatchObject({
      kind: "update",
      update: {
        set: [{ subtask: 2, status: "done" }],
        remove: [1],
        add: ["c"],
        planned: true,
      },
    });
    expect(Object.keys(asks.at(-1)!.update!).sort()).toEqual([
      "add",
      "planned",
      "remove",
      "set",
    ]);
  });

  it("never removes subtasks in a task running alone", async () => {
    const { asks, run } = load(task);
    await run({ remove: [1] });
    expect(asks.at(-1)!.update!.remove).toBeUndefined();
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
    const { call, run, asks } = load(task);
    const blocked = { block: true, reason: PLAN_FIRST };
    expect(await call("edit", { path: "a.ts" })).toEqual(blocked);
    expect(await call("write", { path: "a.ts" })).toEqual(blocked);
    expect(await call("read", { path: "a.ts" })).toBeUndefined();
    await run({});
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

  it("starts only explore subagents until the work is planned", async () => {
    const { call, run } = load(null);
    expect(await call("subagent", { task: "fix it" })).toEqual({
      block: true,
      reason: SUBAGENT_PLAN_FIRST,
    });
    expect(
      await call("subagent", { task: "find it", explore: true }),
    ).toBeUndefined();
    expect(
      await call("subagent", { id: "agent-1", task: "more" }),
    ).toBeUndefined();
    await run({ add: ["x"] });
    expect(await call("subagent", { task: "fix it" })).toBeUndefined();
  });

  it("lets a task planned before a reload change files", async () => {
    const { start, call } = load({ ...task, planned: true });
    await start();
    expect(await call("edit", { path: "a.ts" })).toBeUndefined();
  });

  it("blocks a conversation's file changes until it plans", async () => {
    const { call, run } = load(null);
    expect(await call("edit", { path: "a.ts" })).toEqual({
      block: true,
      reason: PLAN_FIRST,
    });
    await run({ add: ["x"] });
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

  it("doesn't nudge a conversation the user follows", async () => {
    const { start, end, sent } = load({ ...task, interactive: true });
    await start();
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
  it("runs its batch in order, so an edit beside the plan isn't blocked", () => {
    let tool: ToolDefinition | undefined;
    tasks({
      on: () => {},
      registerTool: (t: ToolDefinition) => (tool = t),
      events: createEventBus(),
    } as unknown as ExtensionAPI);
    expect(tool!.executionMode).toBe("sequential");
  });

  it("rejects a call in the old subtask and status shape", () => {
    let tool: ToolDefinition | undefined;
    tasks({
      on: () => {},
      registerTool: (t: ToolDefinition) => (tool = t),
      events: createEventBus(),
    } as unknown as ExtensionAPI);
    const ok = { set: [{ subtask: 2, status: "done" }] };
    expect(Value.Check(tool!.parameters, ok)).toBe(true);
    const old = { subtask: 2, status: "done" };
    expect(Value.Check(tool!.parameters, old)).toBe(false);
  });

  it("emits the update and returns the progress", async () => {
    const { asks, run } = load(task);
    const result = await run({ set: [{ subtask: 2, status: "done" }] });
    expect(asks).toMatchObject([
      { kind: "get" },
      {
        kind: "update",
        update: { set: [{ subtask: 2, status: "done" }], planned: true },
      },
    ]);
    expect(result.content).toEqual([
      { type: "text", text: "1. [done] a\n2. [working] b" },
    ]);
    expect(result.details).toEqual({ subtasks: task.subtasks });
  });

  it("adds a conversation without a task to the list, once", async () => {
    const { asks, run, start } = load(null);
    await start();
    await Promise.all([run({ add: ["x"] }), run({})]);
    expect(asks.filter((a) => a.kind === "add")).toHaveLength(1);
    expect(asks.find((a) => a.kind === "add")!.tasks![0]).toMatchObject({
      title: "Fix login",
      session: "s1",
      interactive: true,
    });
  });

  it("says when the subtasks couldn't be saved, and lets edits through", async () => {
    const events = createEventBus();
    const handlers = new Map<string, Handler>();
    let tool: ToolDefinition | undefined;
    tasks({
      on: (name: string, h: Handler) => handlers.set(name, h),
      registerTool: (t: ToolDefinition) => (tool = t),
      events,
    } as unknown as ExtensionAPI);
    const result = await tool!.execute(
      "t1",
      { add: ["x"] } as never,
      undefined,
      undefined,
      {
        sessionManager: { getSessionId: () => "s1", getBranch: () => [] },
      } as never,
    );
    expect(result.content).toEqual([
      { type: "text", text: "Couldn't save the subtasks." },
    ]);
    const edit = handlers.get("tool_call")!(
      { toolName: "edit", input: { path: "a.ts" } },
      { cwd: "/w" },
    );
    expect(await edit).toBeUndefined();
  });
});

describe("before_agent_start", () => {
  it("swaps ask_user for the task tool, goes autonomous, keeps commands its own", async () => {
    const { start, active } = load(task);
    const result = await start();
    expect(result!.systemPrompt).toBe(
      `Base\n\n${AUTONOMOUS}\n\n${TASK_COMMAND_GUIDANCE}\n\n${TASK_GUIDANCE}`,
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
      `Base\n\n${AUTONOMOUS}\n\n${TASK_COMMAND_GUIDANCE}\n\n${TASK_GUIDANCE}\n${CHROME_GUIDANCE}`,
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

  it("has a conversation without a task plan, and keeps it interactive", async () => {
    const { start, active } = load(null, ["read", "ask_user", "task_update"]);
    expect((await start())!.systemPrompt).toBe(
      `Base\n\n${ASKING}\n\n${COMMAND_GUIDANCE}\n\n${PLAN_GUIDANCE}`,
    );
    expect(active()).toEqual(["read", "ask_user", "task_update", "task_add"]);
  });

  it("keeps a conversation the user follows interactive, reminded of its plan", async () => {
    const mine: Task = { ...task, interactive: true };
    const { start, active } = load(mine);
    expect((await start())!.systemPrompt).toBe(
      `Base\n\n${ASKING}\n\n${COMMAND_GUIDANCE}\n\n${PLAN_GUIDANCE}\n\n${planReminder(mine)}`,
    );
    expect(active()).toEqual(["read", "ask_user", "task_update", "task_add"]);
  });

  it("drops task_add from a task's conversation", async () => {
    const { start, active } = load(task, ["read", "task_add"]);
    await start();
    expect(active()).toEqual(["read", "task_update"]);
  });
});
