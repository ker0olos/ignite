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
  AUTONOMOUS,
  COPYABLE,
  LEFT_TO_AGENT,
  QUESTION_AWAY_MS,
  REPLIES,
  askEnabled,
  awayReply,
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
    events,
  } as unknown as ExtensionAPI);
  const asks: ApprovalAsk[] = [];
  events.on(APPROVAL_EVENT, (data) => void asks.push(data as ApprovalAsk));
  const run = (signal?: AbortSignal) =>
    tool!.execute("t1", { questions: [] }, signal, undefined, {} as never);
  const start = async (prompt = "Hi") => {
    const sections: Record<string, string> = {};
    await handlers.get("before_agent_start")!({
      messageType: "user",
      prompt,
      systemPromptOptions: { sections },
    });
    return sections;
  };
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

  it("goes on without the user after 5 minutes, saying they're away", async () => {
    const { asks, run } = load();
    const result = run();
    await vi.waitFor(() => expect(asks).toHaveLength(1));
    const { away } = asks[0];
    expect(away?.afterMs).toBe(QUESTION_AWAY_MS);
    asks[0].answer(false, undefined, undefined, away!.reason());
    const done = await result;
    expect(text(done)).toMatch(/^The user is away/);
    expect(done.details).toBeUndefined();
  });
});

describe("awayReply", () => {
  it("adds what the user had answered without sending it", () => {
    const reply = awayReply([
      { question: "Where?", choices: ["SQLite"] },
      { question: "Why?", choices: [], note: "speed" },
      { question: "When?", choices: [] },
    ]);
    expect(reply).toMatch(/^The user is away/);
    expect(reply).toContain("Q: Where?\nA: SQLite");
    expect(reply).toContain(
      "Q: Why?\nA: (left to you; decide it)\nNote: speed",
    );
    // A question with nothing answered isn't listed.
    expect(reply).not.toContain("When?");
  });

  it("says only that they're away when nothing was answered", () => {
    const bare = awayReply();
    expect(awayReply([{ question: "When?", choices: [] }])).toBe(bare);
    expect(bare).not.toContain("Q:");
  });
});

describe("before_agent_start", () => {
  it("offers the tool and asks the agent to include the user", async () => {
    const { start, active } = load();
    expect(await start()).toEqual({
      questions: ASKING,
      copyable: COPYABLE,
      replies: REPLIES,
    });
    expect(active()).toEqual(["read", "bash", "ask_user"]);
    await start();
    expect(active()).toEqual(["read", "bash", "ask_user"]);
  });

  it("drops the tool and lets the agent decide alone when turned off", async () => {
    await settings("[conversation]\nask_questions = false\n");
    const { start, active } = load(["read", "ask_user"]);
    expect(await start()).toEqual({
      questions: AUTONOMOUS,
      copyable: COPYABLE,
      replies: REPLIES,
    });
    expect(active()).toEqual(["read"]);
  });
});
