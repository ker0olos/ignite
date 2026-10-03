// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createEventBus,
  type ExtensionAPI,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentMessage } from "../shared/agentTypes.ts";
import { nextSubagentId } from "../shared/subagents.ts";
import subagents, {
  SUBAGENT_EVENT,
  guidance,
  subagentLimits,
  type SubagentAsk,
} from "./subagentExtension.ts";
import { allowedEfforts, allowedModels } from "./subagentModels.ts";
import { APP_NAME } from "../src/lib/app.ts";

let home: string;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "subagents-"));
  vi.stubEnv("HOME", home);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(home, { recursive: true, force: true });
});

const settings = (toml: string) =>
  mkdir(join(home, `.${APP_NAME}`), { recursive: true }).then(() =>
    writeFile(join(home, `.${APP_NAME}`, "settings.toml"), toml),
  );

describe("subagentLimits", () => {
  it("allows 2 without settings, or with bad ones", async () => {
    expect(await subagentLimits()).toEqual({ enabled: true, max: 2 });
    await settings("[subagents]\nmax = 0\n");
    expect(await subagentLimits()).toEqual({ enabled: true, max: 2 });
    await settings("not toml [");
    expect(await subagentLimits()).toEqual({ enabled: true, max: 2 });
  });

  it("reads the switch and the cap", async () => {
    await settings("[subagents]\nenabled = false\nmax = 5\n");
    expect(await subagentLimits()).toEqual({ enabled: false, max: 5 });
  });
});

describe("allowedEfforts", () => {
  it("lists the efforts up to the agent's own", () => {
    expect(allowedEfforts("medium")).toEqual([
      "off",
      "minimal",
      "low",
      "medium",
    ]);
    expect(allowedEfforts("off")).toEqual(["off"]);
  });
});

const model = (provider: string, id: string, output: number) =>
  ({ provider, id, cost: { output } }) as never;
const MODELS = [
  model("openai-codex", "gpt-big", 10),
  model("openai-codex", "gpt-mini", 4),
  model("openai-codex", "gpt-nano", 1),
  model("openai-codex", "gpt-huge", 30),
  model("openai-codex", "gpt-twin", 10),
  model("claude-bridge", "haiku", 0),
];
// Only the API listing prices the bridge's models.
const CATALOG = [...MODELS, model("anthropic", "haiku", 5)];

const reply = (text: string, stopReason = "stop"): AgentMessage =>
  ({
    role: "assistant",
    content: [{ type: "text", text }],
    stopReason,
  }) as never;

/** A subagent session that answers each prompt with `answers`, in order. */
function fakeSession(answers: AgentMessage[]) {
  const listeners = new Set<(e: { type: string }) => void>();
  const session = {
    messages: [] as AgentMessage[],
    isStreaming: false,
    subscribe: (l: (e: { type: string }) => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    abort: vi.fn(async () => {}),
    prompt: vi.fn(async (text: string) => {
      session.messages.push({ role: "user", content: text } as never);
      listeners.forEach((l) => l({ type: "message_end" }));
      session.messages.push(answers.shift()!);
      listeners.forEach((l) => l({ type: "message_end" }));
    }),
    extensionRunner: { emit: vi.fn(async () => {}) },
    dispose: vi.fn(),
  };
  return session;
}

type Handler = (event: object, ctx?: object) => Promise<unknown>;

function load({
  level = "high",
  own = MODELS[0],
  host = true,
  saved = [] as object[],
  opened = Promise.resolve(),
} = {}) {
  const events = createEventBus();
  const handlers = new Map<string, Handler>();
  let active = ["read"];
  let tool: ToolDefinition | undefined;
  subagents({
    on: (name: string, h: Handler) => handlers.set(name, h),
    registerTool: (t: ToolDefinition) => (tool = t),
    getActiveTools: () => active,
    setActiveTools: (names: string[]) => (active = names),
    getThinkingLevel: () => level,
    events,
  } as unknown as ExtensionAPI);
  const asks: SubagentAsk[] = [];
  const sessions: ReturnType<typeof fakeSession>[] = [];
  if (host) {
    events.on(SUBAGENT_EVENT, (data) => {
      const ask = data as SubagentAsk;
      asks.push(ask);
      const s = fakeSession([reply("Found it."), reply("Done.")]);
      sessions.push(s);
      ask.reply(opened.then(() => s as never));
    });
  }
  const ctx = {
    model: own,
    modelRegistry: { getAvailable: () => MODELS, getAll: () => CATALOG },
    sessionManager: { getEntries: () => saved },
  };
  const run = (params: object, signal?: AbortSignal, onUpdate?: never) =>
    tool!.execute("t1", params as never, signal, onUpdate, ctx as never);
  const start = () =>
    handlers.get("before_agent_start")!(
      { systemPrompt: "Base" },
      ctx,
    ) as Promise<{ systemPrompt: string } | undefined>;
  const shutdown = () => handlers.get("session_shutdown")!({});
  return { run, start, shutdown, asks, sessions, active: () => active };
}

const text = (result: { content: { type: string; text?: string }[] }) =>
  result.content[0]?.text;

describe("before_agent_start", () => {
  it("offers the tool with its own model, the provider's no dearer ones and efforts up to its own", async () => {
    const { start, active } = load();
    const models = [MODELS[0], MODELS[1], MODELS[2], MODELS[4]];
    const efforts = allowedEfforts("high");
    expect((await start())?.systemPrompt).toBe(
      `Base\n\n${guidance(models, efforts, 2)}`,
    );
    expect(active()).toEqual(["read", "subagent"]);
  });

  it("drops the tool when turned off", async () => {
    await settings("[subagents]\nenabled = false\n");
    const { start, active } = load();
    expect(await start()).toBeUndefined();
    expect(active()).toEqual(["read"]);
  });

  it("offers its own model at its own effort, even at the bottom", async () => {
    const { start } = load({ level: "off", own: MODELS[2] });
    expect((await start())?.systemPrompt).toBe(
      `Base\n\n${guidance([MODELS[2]], ["off"], 2)}`,
    );
  });
});

describe("subagent ids", () => {
  it("continue past the ids the conversation's saved calls used", async () => {
    const savedCall = (id: string) => ({
      type: "message",
      message: {
        role: "toolResult",
        toolName: "subagent",
        details: {
          id,
          model: "haiku",
          effort: "low",
          messages: [],
          running: false,
        },
      },
    });
    const { run } = load({
      saved: [savedCall("agent-1"), savedCall("agent-2"), { type: "label" }],
    });
    const done = (await run({
      message: "Go",
      model: "gpt-mini",
      effort: "low",
    })) as {
      details: { id: string };
    };
    expect(done.details.id).toBe("agent-3");
  });

  it("number from the highest one taken, ignoring others", () => {
    expect(nextSubagentId([])).toBe("agent-1");
    expect(nextSubagentId(["agent-2", "agent-10", "helper"])).toBe("agent-11");
  });
});

describe("allowedModels", () => {
  it("prices a subscription model by its API listing", () => {
    const bridge = [
      model("claude-bridge", "opus", 0),
      model("claude-bridge", "haiku", 0),
      model("claude-bridge", "mystery", 0),
    ];
    const ctx = {
      model: bridge[0],
      modelRegistry: {
        getAvailable: () => bridge,
        getAll: () => [
          ...bridge,
          model("anthropic", "opus", 20),
          model("anthropic", "haiku", 5),
        ],
      },
    };
    expect(allowedModels(ctx as never).map((m) => m.id)).toEqual([
      "opus",
      "haiku",
    ]);
  });

  it("allows only its own model when its price is unknown", () => {
    const ctx = {
      model: MODELS[5],
      modelRegistry: { getAvailable: () => MODELS, getAll: () => MODELS },
    };
    expect(allowedModels(ctx as never)).toEqual([MODELS[5]]);
  });

  it("allows none without a model", () => {
    const ctx = {
      modelRegistry: { getAvailable: () => MODELS, getAll: () => MODELS },
    };
    expect(allowedModels(ctx as never)).toEqual([]);
  });
});

describe("subagent", () => {
  it("starts one with the chosen model and effort, and returns its reply", async () => {
    const { run, asks } = load();
    const updates: unknown[] = [];
    const result = await run(
      { message: "Find X", model: "gpt-mini", effort: "low" },
      undefined,
      ((u: unknown) => updates.push(u)) as never,
    );
    expect(asks[0]).toMatchObject({
      model: MODELS[1],
      effort: "low",
      tools: undefined,
      prompt: expect.stringContaining("Working as a subagent"),
    });
    expect(text(result)).toBe("agent-1 replied:\n\nFound it.");
    expect(result.details).toMatchObject({
      id: "agent-1",
      model: "gpt-mini",
      effort: "low",
      running: false,
      messages: [{ role: "user", content: "Find X" }, reply("Found it.")],
    });
    expect(updates).toHaveLength(2);
  });

  it("starts an explore one when asked", async () => {
    const { run, asks } = load();
    await run({
      message: "Where is X?",
      model: "gpt-mini",
      effort: "low",
      explore: true,
    });
    expect(asks[0]).toMatchObject({
      tools: ["read", "grep", "find", "ls"],
      prompt: expect.stringContaining("Exploring as a subagent"),
    });
  });

  it("runs an explore one on the cheapest model at low effort by default", async () => {
    const { run, asks } = load();
    await run({ message: "Where is X?", explore: true });
    expect(asks[0]).toMatchObject({ model: MODELS[2], effort: "low" });
  });

  it("gives an explore one the lowest effort allowed when low isn't", async () => {
    const { run, asks } = load({ level: "minimal" });
    await run({ message: "Where is X?", explore: true, model: "gpt-big" });
    expect(asks[0]).toMatchObject({ model: MODELS[0], effort: "minimal" });
  });

  it("continues a conversation by id, showing only the new messages", async () => {
    const { run, sessions } = load();
    await run({ message: "Find X", model: "gpt-mini", effort: "low" });
    const result = await run({ message: "Now fix it", id: "agent-1" });
    expect(sessions).toHaveLength(1);
    expect(text(result)).toBe("agent-1 replied:\n\nDone.");
    expect(result.details).toMatchObject({
      messages: [{ role: "user", content: "Now fix it" }, reply("Done.")],
    });
  });

  it("refuses a dearer model, another provider's, and an effort above its own", async () => {
    const { run } = load();
    await expect(
      run({ message: "x", model: "gpt-huge", effort: "low" }),
    ).rejects.toThrow(
      "Pick a model from: gpt-big, gpt-mini, gpt-nano, gpt-twin.",
    );
    await expect(
      run({ message: "x", model: "haiku", effort: "low" }),
    ).rejects.toThrow("Pick a model");
    await expect(
      run({ message: "x", model: "gpt-mini", effort: "xhigh" }),
    ).rejects.toThrow(
      "Pick an effort up to your own: off, minimal, low, medium, high.",
    );
  });

  it("starts one on its own model and effort", async () => {
    const { run, asks } = load();
    await run({ message: "x", model: "gpt-big", effort: "high" });
    expect(asks[0]).toMatchObject({ model: MODELS[0], effort: "high" });
  });

  it("refuses an unknown id", async () => {
    await expect(load().run({ message: "x", id: "agent-9" })).rejects.toThrow(
      "There is no subagent agent-9",
    );
  });

  it("starts more than the cap, queueing the ones past it", async () => {
    const { run, sessions } = load();
    const start = { message: "x", model: "gpt-mini", effort: "low" };
    const results = await Promise.all([run(start), run(start), run(start)]);
    const ids = results.map((r) => (r.details as { id: string }).id);
    expect(ids).toEqual(["agent-1", "agent-2", "agent-3"]);
    expect(sessions).toHaveLength(3);
  });

  it("refuses to start one when turned off before the run", async () => {
    await settings("[subagents]\nenabled = false\n");
    const { run, start } = load();
    await start();
    await expect(
      run({ message: "x", model: "gpt-mini", effort: "low" }),
    ).rejects.toThrow("Subagents are turned off.");
  });

  it("refuses a busy one", async () => {
    const { run, sessions } = load();
    await run({ message: "x", model: "gpt-mini", effort: "low" });
    sessions[0].isStreaming = true;
    await expect(run({ message: "y", id: "agent-1" })).rejects.toThrow("busy");
  });

  it("reports a failed run", async () => {
    const { run, sessions } = load();
    await run({ message: "x", model: "gpt-mini", effort: "low" });
    sessions[0].prompt.mockImplementationOnce(async () => {
      sessions[0].messages.push({
        ...(reply("") as object),
        stopReason: "error",
        errorMessage: "Rate limited",
      } as never);
    });
    expect(text(await run({ message: "y", id: "agent-1" }))).toBe(
      "agent-1 replied:\n\nIt failed: Rate limited",
    );
  });

  it("stops the subagent when the main run stops", async () => {
    const { run, sessions } = load();
    await run({ message: "x", model: "gpt-mini", effort: "low" });
    const s = sessions[0];
    s.prompt.mockImplementationOnce(
      () =>
        new Promise((done) =>
          s.abort.mockImplementationOnce(async () => done()),
        ),
    );
    const stop = new AbortController();
    const result = run({ message: "y", id: "agent-1" }, stop.signal);
    await vi.waitFor(() => expect(s.prompt).toHaveBeenCalledTimes(2));
    stop.abort();
    await result;
    expect(s.abort).toHaveBeenCalledOnce();
  });

  it("doesn't prompt one stopped while it opened", async () => {
    let open = () => {};
    const opened = new Promise<void>((done) => (open = done));
    const { run, sessions } = load({ opened });
    const stop = new AbortController();
    const result = run(
      { message: "x", model: "gpt-mini", effort: "low" },
      stop.signal,
    );
    await vi.waitFor(() => expect(sessions).toHaveLength(1));
    stop.abort();
    open();
    await expect(result).rejects.toThrow("Stopped.");
    expect(sessions[0].prompt).not.toHaveBeenCalled();
  });

  it("ends the least recently used idle ones past 8", async () => {
    const { run, sessions } = load();
    const start = { message: "x", model: "gpt-nano", effort: "low" };
    for (let i = 0; i < 8; i++) await run(start);
    await run({ message: "y", id: "agent-1" });
    await run(start);
    await vi.waitFor(() => expect(sessions[1].dispose).toHaveBeenCalled());
    expect(sessions[0].dispose).not.toHaveBeenCalled();
    await expect(run({ message: "z", id: "agent-2" })).rejects.toThrow(
      "There is no subagent agent-2",
    );
  });

  it("fails when the host can't open one", async () => {
    await expect(
      load({ host: false }).run({
        message: "x",
        model: "gpt-mini",
        effort: "low",
      }),
    ).rejects.toThrow("Subagents aren't available here.");
  });

  it("ends its subagents with the session", async () => {
    const { run, shutdown, sessions } = load();
    await run({ message: "x", model: "gpt-mini", effort: "low" });
    await shutdown();
    expect(sessions[0].extensionRunner.emit).toHaveBeenCalledWith({
      type: "session_shutdown",
      reason: "quit",
    });
    expect(sessions[0].dispose).toHaveBeenCalled();
  });
});
