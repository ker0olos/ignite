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
import { APPROVAL_EVENT, type ApprovalAsk } from "./approvalAsk.ts";
import ask, {
  ASKING,
  ASK_NUDGE,
  AUTONOMOUS,
  COPYABLE,
  LEFT_TO_AGENT,
  askEnabled,
  endsWithQuestion,
  replyText,
} from "./askExtension.ts";
import { APP_NAME } from "../src/lib/app.ts";

const WROTE = "The user wrote instead.";
const IMAGE = { type: "image" as const, data: "AA==", mimeType: "image/png" };

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
  it("lists each answer, with its note, images, and what was left to the agent", () => {
    expect(
      replyText(true, [
        {
          question: "Where?",
          choices: ["SQLite", "Postgres"],
          note: "fast",
          images: [IMAGE, IMAGE],
        },
        { question: "Why?", choices: [], images: [IMAGE] },
        { question: "How?", choices: [] },
      ]),
    ).toBe(
      "Q: Where?\nA: SQLite\nA: Postgres\nNote: fast\n" +
        "Images: attached images 1-2 below are this answer's @image1-@image2.\n\n" +
        "Q: Why?\nA: (see the attached images)\n" +
        "Image: attached image 3 below is this answer's @image1.\n\n" +
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
    sendMessage: (message: { content: string }) => sent.push(message.content),
    events,
  } as unknown as ExtensionAPI);
  const sent: string[] = [];
  const end = (messages: unknown[]) => handlers.get("agent_end")!({ messages });
  const asks: ApprovalAsk[] = [];
  events.on(APPROVAL_EVENT, (data) => void asks.push(data as ApprovalAsk));
  const run = (signal?: AbortSignal) =>
    tool!.execute("t1", { questions: [] }, signal, undefined, {} as never);
  // `custom`: a run a custom message started (the nudge itself), not the user.
  const start = (prompt = "Hi", custom = false) =>
    handlers.get("before_agent_start")!({
      ...(custom
        ? {
            messageType: "custom",
            message: { customType: "ask-nudge", content: prompt },
          }
        : { messageType: "user", prompt }),
      systemPrompt: "Base",
    }) as Promise<{ systemPrompt: string }>;
  return { asks, run, start, end, sent, active: () => active };
}

const reply = (text: string, stopReason = "stop") => ({
  role: "assistant",
  stopReason,
  content: [{ type: "text", text }],
});

describe("endsWithQuestion", () => {
  it("is true for a finished reply ending in a question", () => {
    expect(endsWithQuestion([reply("Done. Push both branches?")])).toBe(true);
    expect(endsWithQuestion([reply("**Open the PR?**\n")])).toBe(true);
    expect(
      endsWithQuestion([
        { role: "assistant", stopReason: "stop", content: "Fix it?" },
      ]),
    ).toBe(true);
  });

  it("is true for a question to the user in the last paragraph", () => {
    expect(
      endsWithQuestion([
        reply(
          "Done.\n\nShould I commit and push both? I won't open a PR unless you ask.",
        ),
      ]),
    ).toBe(true);
    expect(
      endsWithQuestion([reply("**Should I push both?** I'll wait.")]),
    ).toBe(true);
    expect(endsWithQuestion([reply("(Want me to push?) I'll wait.")])).toBe(
      true,
    );
    expect(
      endsWithQuestion([
        {
          role: "assistant",
          stopReason: "stop",
          content: [
            { type: "text", text: "Should I push?" },
            { type: "text", text: "I won't open a PR." },
          ],
        },
      ]),
    ).toBe(true);
  });

  it("is false otherwise", () => {
    expect(
      endsWithQuestion([reply("If you want, use `a ?? b` here instead.")]),
    ).toBe(false);
    expect(
      endsWithQuestion([reply("Is index i out of range? No, it's guarded.")]),
    ).toBe(false);
    expect(endsWithQuestion([reply("Why? Because it broke.")])).toBe(false);
    expect(
      endsWithQuestion([reply("Want me to push?\n\nPushed it anyway.")]),
    ).toBe(false);
    expect(
      endsWithQuestion([reply("Done.\n\n```ts\nconst a = b ? c : d;\n```")]),
    ).toBe(false);
    expect(endsWithQuestion([reply("Push?", "aborted")])).toBe(false);
    expect(endsWithQuestion([{ role: "user", content: "Push?" }])).toBe(false);
    expect(
      endsWithQuestion([
        { role: "assistant", stopReason: "stop", content: undefined },
      ]),
    ).toBe(false);
    expect(endsWithQuestion([])).toBe(false);
  });
});

describe("agent_end", () => {
  it("nudges once per user message to ask with the tool", async () => {
    const { start, end, sent } = load();
    await start();
    await end([reply("Push?")]);
    await start(ASK_NUDGE, true);
    await end([reply("Push?")]);
    expect(sent).toEqual([ASK_NUDGE]);
    await start("next");
    await end([reply("Merge?")]);
    expect(sent).toEqual([ASK_NUDGE, ASK_NUDGE]);
  });

  it("leaves replies alone without the tool or a question", async () => {
    const { start, end, sent } = load(["read", "ask_user"]);
    await end([reply("Done.")]);
    await settings("[conversation]\nask_questions = false\n");
    await start();
    await end([reply("Push?")]);
    expect(sent).toEqual([]);
  });
});

const text = (result: { content: { type: string; text?: string }[] }) =>
  result.content[0].text;

describe("ask_user", () => {
  it("waits for the user's answers and passes them to the model", async () => {
    const { asks, run } = load();
    const result = run();
    await vi.waitFor(() => expect(asks).toHaveLength(1));
    expect(asks[0].request).toEqual({ toolCallId: "t1" });
    asks[0].answer(true, [{ question: "Where?", choices: ["SQLite"] }]);
    const done = await result;
    expect(text(done)).toBe("Q: Where?\nA: SQLite");
    expect(done.details).toEqual({
      answers: [{ question: "Where?", choices: ["SQLite"] }],
    });
  });

  it("passes the answers' images to the model and counts them in its details", async () => {
    const { asks, run } = load();
    const result = run();
    await vi.waitFor(() => expect(asks).toHaveLength(1));
    asks[0].answer(true, [
      { question: "Where?", choices: ["Here"], images: [IMAGE] },
    ]);
    const done = await result;
    expect(done.content.slice(1)).toEqual([IMAGE]);
    expect(done.details).toEqual({
      answers: [{ question: "Where?", choices: ["Here"], images: 1 }],
    });
  });

  it("leaves the decision to the agent when the run is stopped", async () => {
    const { asks, run } = load();
    const stop = new AbortController();
    const result = run(stop.signal);
    await vi.waitFor(() => expect(asks).toHaveLength(1));
    stop.abort();
    expect(text(await result)).toBe(LEFT_TO_AGENT);
  });

  it("tells the model the host's reason for denying it", async () => {
    const { asks, run } = load();
    const result = run();
    await vi.waitFor(() => expect(asks).toHaveLength(1));
    asks[0].answer(false, undefined, undefined, WROTE);
    expect(text(await result)).toBe(WROTE);
  });
});

describe("before_agent_start", () => {
  it("offers the tool and asks the agent to include the user", async () => {
    const { start, active } = load();
    expect((await start()).systemPrompt).toBe(
      `Base\n\n${ASKING}\n\n${COPYABLE}`,
    );
    expect(active()).toEqual(["read", "bash", "ask_user"]);
    await start();
    expect(active()).toEqual(["read", "bash", "ask_user"]);
  });

  it("drops the tool and lets the agent decide alone when turned off", async () => {
    await settings("[conversation]\nask_questions = false\n");
    const { start, active } = load(["read", "ask_user"]);
    expect((await start()).systemPrompt).toBe(
      `Base\n\n${AUTONOMOUS}\n\n${COPYABLE}`,
    );
    expect(active()).toEqual(["read"]);
  });
});
