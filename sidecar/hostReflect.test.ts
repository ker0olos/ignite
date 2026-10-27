// @vitest-environment node
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentMessage } from "../shared/agentTypes.ts";
import type { Reflection } from "../shared/reflector.ts";
import {
  feedbackOf,
  noteDenied,
  noteRewound,
  reflectOn,
  reflectorHandlers,
} from "./hostReflect.ts";
import type { Agent, HostContext } from "./hostTypes.ts";
import { forkReport } from "./forks.ts";
import { learningOn } from "./learningSettings.ts";
import { reflect } from "./reflector.ts";
import { WRAP_UP } from "./taskExtension.ts";

const { file } = vi.hoisted(() => ({
  file: `${process.env.TMPDIR ?? "/tmp"}/host-reflect-${process.pid}.json`,
}));
vi.mock("./reflector.ts", () => ({ reflect: vi.fn() }));
// The real one reads the user's settings.toml.
vi.mock("./learningSettings.ts", () => ({
  learningOn: vi.fn(async () => true),
}));
vi.mock("./reflectorExtension.ts", async (orig) => ({
  ...(await orig<typeof import("./reflectorExtension.ts")>()),
  REFLECTOR_FILE: file,
}));

afterEach(() => {
  rmSync(file, { force: true });
  vi.mocked(reflect).mockReset();
});

const point = (over: Partial<Reflection> = {}): Reflection => ({
  id: "r1",
  text: "Keep reports short.",
  entry: "always",
  taught: "note",
  at: 1,
  ...over,
});

const call = (id: string, name: string, args: object) =>
  ({
    role: "assistant",
    content: [{ type: "toolCall", id, name, arguments: args }],
    timestamp: 2,
  }) as unknown as AgentMessage;

const user = (content: string, timestamp: number) =>
  ({ role: "user", content, timestamp }) as AgentMessage;

const saved = (id: string, modified: number) => ({
  id,
  title: id,
  modified,
  messageCount: 3,
  text: "",
});

const agentWith = (messages: AgentMessage[] = [], runAfter?: number) =>
  ({
    id: "c1",
    cwd: "/work",
    runAfter,
    session: { messages },
  }) as unknown as Agent;

describe("noting corrections", () => {
  it("notes a denied call with its arguments, and one written over", () => {
    const agent = agentWith([
      user("hi", 1),
      call("a", "git", { args: ["push", "--force"], reason: "ship" }),
    ]);
    noteDenied(agent, "a");
    noteDenied(agent, "a", true);
    expect(agent.corrections).toEqual([
      "The user denied this call: git push --force",
      "The user didn't let this call run and wrote to the agent instead: git push --force",
    ]);
  });

  it("skips declined questions and proposals, and calls it can't see", () => {
    const agent = agentWith([
      call("q", "ask_user", { questions: [] }),
      call("t", "task_add", { tasks: [] }),
      call("l", "lesson_add", { text: "x" }),
    ]);
    for (const id of ["q", "t", "l", "gone"]) noteDenied(agent, id);
    expect(agent.corrections).toBeUndefined();
  });

  it("notes a rewind with what it dropped, leaving the new message to the run", () => {
    const agent = agentWith();
    const branch = [
      { id: "1", message: user("old ask", 1) },
      { id: "2" },
      { id: "3", message: user("older", 1) },
    ];
    noteRewound(agent, branch, "3");
    expect(agent.corrections?.[0]).toContain("[User]: older");
    expect(agent.corrections?.[0]).not.toContain("old ask");
    expect(agent.corrections?.[0]).toContain("sent the run's message instead");
  });
});

describe("feedbackOf", () => {
  const asked = {
    role: "toolResult",
    toolName: "ask_user",
    toolCallId: "q",
    timestamp: 6,
    details: {
      answers: [
        {
          question: "Which of these should I take on?",
          choices: [],
          note: "make subtasks then start with the noise",
        },
        { question: "Branch?", choices: ["New branch"] },
        { question: "Name?", choices: ["call it reflector"] },
      ],
    },
  } as unknown as AgentMessage;
  const offered = call("q", "ask_user", {
    questions: [
      {
        question: "Branch?",
        options: [{ label: "New branch" }, { label: "Main" }],
      },
      { question: "Name?", options: [{ label: "Habits" }, { label: "Guide" }] },
    ],
  });

  it("reads the user's replies and what they wrote answering, not the opening message or bare picks", () => {
    const messages = [
      user("triage sentry", 5),
      offered,
      asked,
      { role: "custom", content: "wrap up", timestamp: 7 } as AgentMessage,
      user("/skill-free reply: shorter please", 8),
    ];
    expect(feedbackOf(messages, 4)).toEqual([
      'The agent asked "Which of these should I take on?"; the user answered (nothing picked), with the note: make subtasks then start with the noise',
      'The agent asked "Name?"; the user answered call it reflector',
      "The user wrote: /skill-free reply: shorter please",
    ]);
  });

  it("counts a run's first message as a reply once the conversation has begun", () => {
    const messages = [user("triage sentry", 1), user("too long", 5)];
    expect(feedbackOf(messages, 4)).toEqual(["The user wrote: too long"]);
    expect(feedbackOf(messages, 5)).toEqual([]);
  });

  it("skips what the app sends as the user: a task's wrap-up, a fork's report", () => {
    const messages = [
      user("triage sentry", 1),
      user(WRAP_UP, 5),
      user(forkReport("Try it", "f1", "Done."), 6),
    ];
    expect(feedbackOf(messages, 4)).toEqual([]);
  });
});

describe("reflectOn", () => {
  it("keeps corrections for the next run when this settle had none", async () => {
    const agent = agentWith([user("a", 1)]);
    agent.corrections = ["The user denied this call: git push"];
    await reflectOn(agent, { file });
    expect(agent.corrections).toEqual(["The user denied this call: git push"]);
  });

  it("does nothing without feedback, a session or a run", async () => {
    await reflectOn(agentWith([user("first", 5)], 4), { file });
    await reflectOn({ ...agentWith(), session: null } as Agent, { file });
    await reflectOn(agentWith([user("a", 1), user("b", 5)]), { file });
    expect(reflect).not.toHaveBeenCalled();
  });

  it("rewrites the points from the run's feedback and corrections, then clears them", async () => {
    writeFileSync(file, JSON.stringify([point()]));
    const next = [
      point(),
      point({ id: "r2", entry: "asking", text: "Ask one by one." }),
    ];
    vi.mocked(reflect).mockResolvedValue(next);
    const agent = agentWith([user("triage", 1), user("too long", 5)], 4);
    agent.title = "Sentry triage";
    agent.corrections = ["The user denied this call: git push"];
    await reflectOn(agent, { file });
    expect(vi.mocked(reflect).mock.calls[0].slice(1, 4)).toEqual([
      ["The user denied this call: git push", "The user wrote: too long"],
      agent.session!.messages,
      [point()],
    ]);
    expect(vi.mocked(reflect).mock.calls[0][4]).toEqual({
      conversation: "c1",
      folder: "/work",
      title: "Sentry triage",
    });
    expect(agent.corrections).toEqual([]);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(next);
  });

  it("reflects on nothing switched off, still clearing the run's corrections", async () => {
    vi.mocked(learningOn).mockResolvedValueOnce(false);
    const agent = agentWith([user("triage", 1), user("too long", 5)], 4);
    agent.corrections = ["The user denied this call: git push"];
    await reflectOn(agent, { file });
    expect(learningOn).toHaveBeenCalledWith("reflector");
    expect(reflect).not.toHaveBeenCalled();
    expect(agent.corrections).toEqual([]);
  });

  it("leaves the points when the reflector keeps them or fails", async () => {
    const agent = agentWith([user("triage", 1), user("too long", 5)], 4);
    vi.mocked(reflect).mockResolvedValue(undefined);
    await reflectOn(agent, { file });
    vi.mocked(reflect).mockRejectedValue(new Error("offline"));
    await reflectOn(agent, { file });
    expect(() => readFileSync(file)).toThrow();
  });

  it("shows the reflector only this folder's points and what was asked in its other conversations, keeping other folders' points", async () => {
    const other = point({ id: "r9", folder: "/elsewhere" });
    writeFileSync(file, JSON.stringify([point(), other]));
    const next = [point({ text: "Show the fix, then open a PR." })];
    vi.mocked(reflect).mockResolvedValue(next);
    const sessions = {
      list: async () => [saved("c1", 3), saved("c3", 2), saved("c2", 1)],
      read: async (_folder: string, id: string) => [
        user("triage", 1),
        user(`work on ${id} with <private>sk-1</private>`, 2),
        user(WRAP_UP, 3),
        user("ok pr", 4),
      ],
    };
    const agent = agentWith([user("triage", 1), user("ok pr", 5)], 4);
    await reflectOn(agent, { file, sessions });
    expect(vi.mocked(reflect).mock.calls[0][3]).toEqual([point()]);
    expect(vi.mocked(reflect).mock.calls[0][5]).toEqual([
      ["work on c3 with [private]", "ok pr"],
      ["work on c2 with [private]", "ok pr"],
    ]);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual([...next, other]);
  });

  it("reflects without the other conversations when they can't be read", async () => {
    vi.mocked(reflect).mockResolvedValue(undefined);
    const sessions = {
      list: async () => Promise.reject(new Error("gone")),
      read: async () => [],
    };
    await reflectOn(agentWith([user("triage", 1), user("ok pr", 5)], 4), {
      file,
      sessions,
    });
    expect(vi.mocked(reflect).mock.calls[0][5]).toEqual([]);
  });
});

describe("reflectorHandlers", () => {
  const ctx = {} as HostContext;

  it("lists, edits (as the user's own) and removes points", async () => {
    expect(reflectorHandlers.reflections_list()).toEqual([]);
    const from = { conversation: "c1", folder: "/work", title: "Triage" };
    writeFileSync(
      file,
      JSON.stringify([
        point({
          from,
          when: "reporting",
          evidence: "shorter",
          folder: "/work",
        }),
        point({ id: "r2" }),
      ]),
    );
    const edited = await reflectorHandlers.reflections_edit(ctx, {
      reflection: "r1",
      text: "  Be brief.  ",
    });
    expect(edited[0]).toMatchObject({
      id: "r1",
      text: "Be brief.",
      taught: "edit",
    });
    expect(edited[0].at).toBeGreaterThan(1);
    expect(edited[0].from).toBeUndefined();
    // Wholly the user's own now, for all work.
    expect(edited[0].when).toBeUndefined();
    expect(edited[0].evidence).toBeUndefined();
    expect(edited[0].folder).toBeUndefined();
    expect(edited[1]).toEqual(point({ id: "r2" }));
    const same = await reflectorHandlers.reflections_edit(ctx, {
      reflection: "r1",
      text: "Be brief.",
    });
    expect(same[0].at).toBe(edited[0].at);
    expect(
      await reflectorHandlers.reflections_remove(ctx, { reflection: "r2" }),
    ).toEqual([edited[0]]);
  });

  it("removes a point edited to nothing", async () => {
    writeFileSync(file, JSON.stringify([point()]));
    expect(
      await reflectorHandlers.reflections_edit(ctx, {
        reflection: "r1",
        text: " ",
      }),
    ).toEqual([]);
  });
});
