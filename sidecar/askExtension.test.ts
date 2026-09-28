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
import { APPROVAL_EVENT, type ApprovalAsk } from "./approvalExtension.ts";
import ask, {
  ASKING,
  AUTONOMOUS,
  LEFT_TO_AGENT,
  askEnabled,
  replyText,
} from "./askExtension.ts";
import { APP_NAME } from "../src/lib/app.ts";

let home: string;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "ask-"));
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

describe("askEnabled", () => {
  it("is on without a settings file, a setting, or with a bad one", async () => {
    expect(await askEnabled()).toBe(true);
    await settings("[conversation]\nshow_thinking = true\n");
    expect(await askEnabled()).toBe(true);
    await settings("not toml [");
    expect(await askEnabled()).toBe(true);
  });

  it("is off when settings.toml turns it off", async () => {
    await settings("[conversation]\nask_questions = false\n");
    expect(await askEnabled()).toBe(false);
  });
});

describe("replyText", () => {
  it("lists each answer, with notes, and what was left to the agent", () => {
    expect(
      replyText(true, [
        { question: "Where?", choices: ["SQLite", "Postgres"], note: "fast" },
        { question: "How?", choices: [] },
      ]),
    ).toBe(
      "Q: Where?\nA: SQLite; Postgres\nNote: fast\n\n" +
        "Q: How?\nA: (left to you; decide it)",
    );
  });

  it("leaves everything to the agent when declined", () => {
    expect(replyText(false)).toBe(LEFT_TO_AGENT);
  });
});

type Handler = (event: object) => Promise<unknown>;

function load(active = ["read", "bash"]) {
  const events = createEventBus();
  const handlers = new Map<string, Handler>();
  let tool: ToolDefinition | undefined;
  ask({
    on: (name: string, h: Handler) => handlers.set(name, h),
    registerTool: (t: ToolDefinition) => (tool = t),
    getActiveTools: () => active,
    setActiveTools: (names: string[]) => (active = names),
    events,
  } as unknown as ExtensionAPI);
  const asks: ApprovalAsk[] = [];
  events.on(APPROVAL_EVENT, (data) => void asks.push(data as ApprovalAsk));
  const run = (signal?: AbortSignal) =>
    tool!.execute("t1", { questions: [] }, signal, undefined, {} as never);
  const start = () =>
    handlers.get("before_agent_start")!({ systemPrompt: "Base" }) as Promise<{
      systemPrompt: string;
    }>;
  return { asks, run, start, active: () => active };
}

const text = (result: { content: { type: string; text?: string }[] }) =>
  result.content[0].text;

describe("ask_user", () => {
  it("waits for the user's answers and passes them to the model", async () => {
    const { asks, run } = load();
    const result = run();
    await vi.waitFor(() => expect(asks).toHaveLength(1));
    expect(asks[0].request).toEqual({ toolCallId: "t1" });
    asks[0].answer(true, [{ question: "Where?", choices: ["SQLite"] }]);
    expect(text(await result)).toBe("Q: Where?\nA: SQLite");
  });

  it("leaves the decision to the agent when the run is stopped", async () => {
    const { asks, run } = load();
    const stop = new AbortController();
    const result = run(stop.signal);
    await vi.waitFor(() => expect(asks).toHaveLength(1));
    stop.abort();
    expect(text(await result)).toBe(LEFT_TO_AGENT);
  });
});

describe("before_agent_start", () => {
  it("offers the tool and asks the agent to include the user", async () => {
    const { start, active } = load();
    expect((await start()).systemPrompt).toBe(`Base\n\n${ASKING}`);
    expect(active()).toEqual(["read", "bash", "ask_user"]);
    await start();
    expect(active()).toEqual(["read", "bash", "ask_user"]);
  });

  it("drops the tool and lets the agent decide alone when turned off", async () => {
    await settings("[conversation]\nask_questions = false\n");
    const { start, active } = load(["read", "ask_user"]);
    expect((await start()).systemPrompt).toBe(`Base\n\n${AUTONOMOUS}`);
    expect(active()).toEqual(["read"]);
  });
});
