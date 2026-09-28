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
import subagents, {
  SUBAGENT_EVENT,
  allowedEfforts,
  allowedModels,
  guidance,
  subagentLimits,
  type SubagentAsk,
} from "./subagentExtension.ts";
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
  it("lists only the efforts below the agent's own", () => {
    expect(allowedEfforts("medium")).toEqual(["off", "minimal", "low"]);
    expect(allowedEfforts("off")).toEqual([]);
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

function load({ level = "high", own = MODELS[0], host = true } = {}) {
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
      ask.reply(Promise.resolve(s as never));
    });
  }
  const ctx = {
    model: own,
    modelRegistry: { getAvailable: () => MODELS, getAll: () => CATALOG },
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
  it("offers the tool with the provider's other models and lower efforts", async () => {
    const { start, active } = load();
    const models = [MODELS[1], MODELS[2]];
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

  it("drops the tool without a lower effort or another model", async () => {
    expect(await load({ level: "off" }).start()).toBeUndefined();
    expect(await load({ own: MODELS[2] }).start()).toBeUndefined();
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
    expect(allowedModels(ctx as never).map((m) => m.id)).toEqual(["haiku"]);
  });

  it("allows none when its own price is unknown", () => {
    const ctx = {
      model: MODELS[5],
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
    expect(asks[0]).toMatchObject({ model: MODELS[1], effort: "low" });
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

  it("refuses its own model, one as big or bigger, another provider's, and an effort not below its own", async () => {
    const { run } = load();
    await expect(
      run({ message: "x", model: "gpt-big", effort: "low" }),
    ).rejects.toThrow("Pick a model from: gpt-mini, gpt-nano.");
    await expect(
      run({ message: "x", model: "haiku", effort: "low" }),
    ).rejects.toThrow("Pick a model");
    for (const big of ["gpt-huge", "gpt-twin"]) {
      await expect(
        run({ message: "x", model: big, effort: "low" }),
      ).rejects.toThrow("Pick a model");
    }
    await expect(
      run({ message: "x", model: "gpt-mini", effort: "high" }),
    ).rejects.toThrow(
      "Pick an effort below your own: off, minimal, low, medium.",
    );
  });

  it("refuses an unknown id", async () => {
    await expect(load().run({ message: "x", id: "agent-9" })).rejects.toThrow(
      "There is no subagent agent-9",
    );
  });

  it("stops at the cap, even for calls made at the same time", async () => {
    const { run, sessions } = load();
    const start = { message: "x", model: "gpt-mini", effort: "low" };
    const results = await Promise.allSettled([
      run(start),
      run(start),
      run(start),
    ]);
    expect(results.map((r) => r.status)).toEqual([
      "fulfilled",
      "fulfilled",
      "rejected",
    ]);
    expect(sessions).toHaveLength(2);
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
