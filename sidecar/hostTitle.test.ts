// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentMessage } from "../shared/agentTypes.ts";
import type { Agent, HostContext } from "./hostTypes.ts";

const askCheapest = vi.fn<(...args: unknown[]) => Promise<string | null>>();
const pushProjects = vi.fn();
vi.mock("./cheapCall.ts", () => ({ askCheapest }));
vi.mock("./hostProjects.ts", () => ({ pushProjects }));

const { autoTitle, parseTitle, rename, titleInput, untitled, userNamed } =
  await import("./hostTitle.ts");
const { WRAP_UP } = await import("./taskExtension.ts");

const user = (content: string) =>
  ({ role: "user", content, timestamp: 0 }) as AgentMessage;
const assistant = (text: string) =>
  ({
    role: "assistant",
    content: [{ type: "text", text }],
    timestamp: 0,
  }) as AgentMessage;

function setup(
  messages = [
    user("@image1 can u look at this"),
    assistant("The login button overlaps the logo."),
  ],
) {
  const entries: { customType?: string }[] = [];
  const s = {
    messages,
    setSessionName: vi.fn(),
    sessionManager: {
      getEntries: () => entries,
      appendCustomEntry: (customType: string) => entries.push({ customType }),
    },
  };
  const agent = {
    id: "s1",
    title: "@image1 can u look at this",
    untitled: true,
    session: s,
    opening: Promise.resolve(s),
  } as unknown as Agent;
  const ctx = {
    shown: "s1",
    agents: new Map([["s1", agent]]),
  } as unknown as HostContext;
  return { ctx, agent, s };
}

beforeEach(() => {
  askCheapest.mockReset();
  pushProjects.mockClear();
});

describe("titleInput", () => {
  it("is the first message, then the conversation's last words", () => {
    const long = "x".repeat(3_000);
    const input = titleInput([
      user("Fix the login page"),
      {
        role: "toolResult",
        content: [],
        timestamp: 0,
      } as unknown as AgentMessage,
      assistant(long),
      user("<private>secret</private> thanks"),
    ]);
    expect(input.startsWith("Fix the login page\n\n…\n\n")).toBe(true);
    expect(input.endsWith("[private] thanks")).toBe(true);
    expect(input).not.toContain("secret");
    expect(input.length).toBeLessThan(1_100);
  });

  it("is the first message alone before any reply", () => {
    expect(titleInput([user("Hello there")])).toBe("Hello there");
  });

  it("leaves out what the app sends as the user's, and never leads with a reply", () => {
    const image = {
      role: "user",
      content: [{ type: "image", data: "", mimeType: "image/png" }],
      timestamp: 0,
    } as AgentMessage;
    expect(titleInput([image, assistant("A login form"), user(WRAP_UP)])).toBe(
      "A login form",
    );
  });
});

describe("untitled", () => {
  it("waits for the model's title with none saved, or only the first message's line", () => {
    const { s } = setup();
    const session = s as unknown as Parameters<typeof untitled>[0];
    expect(untitled(session, undefined)).toBe(true);
    expect(untitled(session, "@image1 can u look at this")).toBe(true);
    expect(untitled(session, "Login button overlap")).toBe(false);
    s.sessionManager.appendCustomEntry("ignite-renamed");
    expect(untitled(session, "@image1 can u look at this")).toBe(false);
  });
});

describe("parseTitle", () => {
  it("reads the JSON's title, prose around it ignored", () => {
    expect(parseTitle('Sure: {"title": " Login button overlap "}')).toBe(
      "Login button overlap",
    );
  });

  it.each([null, "no json", '{"title": ""}', '{"title": 3}'])(
    "is null for %s",
    (reply) => expect(parseTitle(reply)).toBeNull(),
  );
});

describe("autoTitle", () => {
  it("titles an untitled conversation once, saving the name", async () => {
    const { ctx, agent, s } = setup();
    askCheapest.mockResolvedValue('{"title": "Login button overlap"}');
    await autoTitle(ctx, agent);
    expect(agent.title).toBe("Login button overlap");
    expect(s.setSessionName).toHaveBeenCalledWith("Login button overlap");
    expect(pushProjects).toHaveBeenCalled();
    await autoTitle(ctx, agent);
    expect(askCheapest).toHaveBeenCalledTimes(1);
  });

  it("leaves a fork, a titled or an empty conversation alone", async () => {
    for (const change of [
      { forkOf: "s0" },
      { untitled: false },
      { session: { messages: [] } },
    ]) {
      const { ctx, agent } = setup();
      Object.assign(agent, change);
      await autoTitle(ctx, agent);
    }
    expect(askCheapest).not.toHaveBeenCalled();
  });

  it("tries again at the next settle when the model gave nothing", async () => {
    const { ctx, agent, s } = setup();
    askCheapest.mockResolvedValue(null);
    await autoTitle(ctx, agent);
    expect(agent.untitled).toBe(true);
    expect(s.setSessionName).not.toHaveBeenCalled();
  });

  it("keeps a name the user gave while the model wrote", async () => {
    const { ctx, agent, s } = setup();
    askCheapest.mockImplementation(async () => {
      agent.title = "Mine";
      return '{"title": "Theirs"}';
    });
    await autoTitle(ctx, agent);
    expect(agent.title).toBe("Mine");
    expect(s.setSessionName).not.toHaveBeenCalled();
    expect(agent.untitled).toBe(false);
  });

  it("stays untitled when the first message was edited while the model failed", async () => {
    const { ctx, agent } = setup();
    askCheapest.mockImplementation(async () => {
      agent.title = "Edited";
      agent.untitled = true;
      return null;
    });
    await autoTitle(ctx, agent);
    expect(agent.untitled).toBe(true);
  });
});

describe("rename", () => {
  it("names the conversation as typed, and it's no longer titled for", async () => {
    const { ctx, agent, s } = setup();
    await rename(ctx, "s1", "  Logo work ");
    expect(agent.title).toBe("Logo work");
    expect(s.setSessionName).toHaveBeenCalledWith("Logo work");
    expect(agent.untitled).toBe(false);
    expect(userNamed(s.sessionManager)).toBe(true);
    expect(askCheapest).not.toHaveBeenCalled();
  });

  it("takes only the first line of a typed name", async () => {
    const { ctx, agent } = setup();
    await rename(ctx, "s1", "Logo work\nand more");
    expect(agent.title).toBe("Logo work");
  });

  it("names nothing once the conversation closed meanwhile", async () => {
    const { ctx, agent, s } = setup();
    askCheapest.mockImplementation(async () => {
      ctx.agents.delete("s1");
      return '{"title": "Late"}';
    });
    await rename(ctx, "s1");
    expect(agent.title).not.toBe("Late");
    expect(s.setSessionName).not.toHaveBeenCalled();
  });

  it("refuses a conversation that isn't open", async () => {
    await expect(rename(setup().ctx, "s9", "x")).rejects.toThrow(/isn't open/);
  });

  it("has the model title it without a name", async () => {
    const { ctx, agent, s } = setup();
    askCheapest.mockResolvedValue('{"title": "Login button overlap"}');
    await rename(ctx, undefined, "");
    expect(agent.title).toBe("Login button overlap");
    expect(userNamed(s.sessionManager)).toBe(false);
  });

  it("refuses when the model gives nothing, or there's nothing to name", async () => {
    const { ctx } = setup();
    askCheapest.mockResolvedValue(null);
    await expect(rename(ctx, "s1")).rejects.toThrow(/rename <title>/);
    const empty = setup([]);
    await expect(rename(empty.ctx, "s1")).rejects.toThrow(/rename <title>/);
    expect(askCheapest).toHaveBeenCalledTimes(1);
  });
});
