// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentMessage } from "../shared/agentTypes.ts";
import type { ProposedLesson, ProposedSkill } from "../shared/lessons.ts";
import { changeSkills } from "./hostMcp.ts";
import {
  answerProposal,
  lessonHandlers,
  noteDenied,
  noteRewound,
  reflectOn,
} from "./hostReflect.ts";
import type { Agent, HostContext } from "./hostTypes.ts";
import { addLesson, readLessons } from "./lessons.ts";
import { reflect } from "./reflector.ts";

const { file } = vi.hoisted(() => ({
  file: `${process.env.TMPDIR ?? "/tmp"}/host-reflect-${process.pid}.json`,
}));
vi.mock("./lessonExtension.ts", () => ({ LESSONS_FILE: file }));
vi.mock("./reflector.ts", () => ({ reflect: vi.fn() }));
vi.mock("./hostMcp.ts", () => ({
  changeSkills: vi.fn(async (_ctx: unknown, edit: () => Promise<void>) => {
    await edit();
  }),
}));

afterEach(() => {
  rmSync(file, { force: true });
  vi.mocked(reflect).mockReset();
});

const call = (id: string, name: string, args: object) =>
  ({
    role: "assistant",
    content: [{ type: "toolCall", id, name, arguments: args }],
  }) as unknown as AgentMessage;

const agentWith = (messages: AgentMessage[] = []) =>
  ({ id: "c1", cwd: "/work", session: { messages } }) as unknown as Agent;

const contextOf = (agent: Agent, appSkills: unknown[] = []) =>
  ({
    agents: new Map([[agent.id, agent]]),
    send: vi.fn(),
    skills: { appSkills: () => appSkills, addToSkill: vi.fn(async () => {}) },
  }) as unknown as HostContext;

const proposal = (over: Partial<ProposedLesson> = {}): ProposedLesson => ({
  kind: "lesson",
  id: "p1",
  text: "Never force-push",
  level: "tool_call",
  tool: "git",
  match: "--force",
  folderOnly: true,
  evidence: "denied",
  ...over,
});

const skillProposal = (over: Partial<ProposedSkill> = {}): ProposedSkill => ({
  kind: "skill",
  id: "s1",
  skill: "migrations",
  add: "## Generating\nAsk the user to run it.",
  evidence: "denied drizzle-kit",
  ...over,
});

describe("noting corrections", () => {
  it("notes a denied call with its arguments, and one written over", () => {
    const agent = agentWith([
      { role: "user", content: "hi", timestamp: 1 } as AgentMessage,
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
      call("r", "lesson_remove", { id: "x" }),
    ]);
    for (const id of ["q", "t", "l", "r", "gone"]) noteDenied(agent, id);
    expect(agent.corrections).toBeUndefined();
    const closed = { ...agentWith(), session: null } as Agent;
    noteDenied(closed, "gone");
    expect(closed.corrections).toBeUndefined();
  });

  it("notes a rewind with what it dropped and what replaced it", () => {
    const agent = agentWith();
    const branch = [
      { id: "1", message: { role: "user", content: "old ask", timestamp: 1 } },
      { id: "2" },
      { id: "3", message: { role: "user", content: "older", timestamp: 1 } },
    ] as { id: string; message?: AgentMessage }[];
    noteRewound(agent, branch, "3", "new ask");
    expect(agent.corrections?.[0]).toContain("[User]: older");
    expect(agent.corrections?.[0]).not.toContain("old ask");
    expect(agent.corrections?.[0]).toContain("sent instead: new ask");
  });
});

describe("reflectOn", () => {
  it("does nothing without corrections or a session", async () => {
    const agent = agentWith();
    await reflectOn(contextOf(agent), agent, file);
    await reflectOn(
      contextOf(agent),
      { ...agent, session: null, corrections: ["x"] } as Agent,
      file,
    );
    expect(reflect).not.toHaveBeenCalled();
  });

  it("proposes what it found, telling the app, and avoids what's known", async () => {
    addLesson(file, { text: "Saved one", level: "system_prompt" });
    addLesson(file, {
      text: "Elsewhere",
      level: "system_prompt",
      folder: "/other",
    });
    const agent = agentWith();
    agent.corrections = ["denied"];
    agent.proposals = [
      proposal({ id: "old", text: "Pending one" }),
      skillProposal({ add: "Pending steps" }),
    ];
    const ctx = contextOf(agent);
    vi.mocked(reflect).mockResolvedValue([proposal()]);
    await reflectOn(ctx, agent, file);
    expect(reflect).toHaveBeenCalledWith(
      agent.session,
      ["denied"],
      ["Saved one", "Pending one", "migrations: Pending steps"],
      [],
    );
    expect(agent.corrections).toEqual([]);
    expect(agent.proposals.map((p) => p.id)).toEqual(["old", "s1", "p1"]);
    expect(ctx.send).toHaveBeenCalledWith({
      type: "lesson_proposals",
      session: "c1",
      lessons: agent.proposals,
    });
  });

  it("gives the reflector the app's skills, with the content of those the run used", async () => {
    const dir = mkdtempSync(join(tmpdir(), "reflect-skills-"));
    const used = join(dir, "used.md");
    writeFileSync(used, "# Used\nsteps");
    const agent = agentWith([call("r", "read", { path: used })]);
    agent.corrections = ["denied"];
    const skills = [
      { name: "used", description: "U", filePath: used },
      { name: "idle", description: "I", filePath: join(dir, "idle.md") },
      { name: "gone", description: "G", filePath: join(dir, "gone.md") },
    ];
    agent.session!.messages.push(
      call("g", "read", { path: skills[2].filePath }),
    );
    vi.mocked(reflect).mockResolvedValue([]);
    await reflectOn(contextOf(agent, skills), agent, file);
    expect(vi.mocked(reflect).mock.calls[0][3]).toEqual([
      { name: "used", description: "U", content: "# Used\nsteps" },
      { name: "idle", description: "I", content: undefined },
      { name: "gone", description: "G", content: undefined },
    ]);
    rmSync(dir, { recursive: true, force: true });
  });

  it("drops what it found when there's none, or the conversation closed meanwhile", async () => {
    const agent = agentWith();
    const ctx = contextOf(agent);
    agent.corrections = ["denied"];
    vi.mocked(reflect).mockResolvedValue([]);
    await reflectOn(ctx, agent, file);
    agent.corrections = ["denied"];
    vi.mocked(reflect).mockImplementation(async () => {
      ctx.agents.delete("c1");
      return [proposal()];
    });
    await reflectOn(ctx, agent, file);
    expect(agent.proposals).toBeUndefined();
    expect(ctx.send).not.toHaveBeenCalled();
  });

  it("drops what another reflection proposed while it ran", async () => {
    const agent = agentWith();
    agent.corrections = ["denied"];
    vi.mocked(reflect).mockImplementation(async () => {
      agent.proposals = [proposal({ id: "other" })];
      return [proposal(), proposal({ id: "p2", text: "New one" })];
    });
    await reflectOn(contextOf(agent), agent, file);
    expect(agent.proposals?.map((p) => p.id)).toEqual(["other", "p2"]);
  });
});

describe("answering proposals", () => {
  it("keeps one as a lesson for the folder, or for every folder", async () => {
    const agent = agentWith();
    agent.proposals = [
      proposal(),
      proposal({
        id: "p2",
        folderOnly: false,
        level: "system_prompt",
        tool: undefined,
        match: undefined,
      }),
    ];
    const ctx = contextOf(agent);
    const left = await answerProposal(ctx, "c1", "p1", true, file);
    expect(left.map((p) => p.id)).toEqual(["p2"]);
    await answerProposal(ctx, "c1", "p2", true, file);
    expect(readLessons(file)).toMatchObject([
      {
        text: "Never force-push",
        tool: "git",
        match: "--force",
        folder: "/work",
      },
      { text: "Never force-push", level: "system_prompt", folder: undefined },
    ]);
    expect(ctx.send).toHaveBeenLastCalledWith({
      type: "lesson_proposals",
      session: "c1",
      lessons: [],
    });
  });

  it("keeps a skill section by adding it to the skill and reloading sessions", async () => {
    const agent = agentWith();
    agent.proposals = [skillProposal({ description: "New one" })];
    const ctx = contextOf(agent);
    expect(await answerProposal(ctx, "c1", "s1", true, file)).toEqual([]);
    expect(changeSkills).toHaveBeenCalledWith(ctx, expect.any(Function));
    expect(ctx.skills.addToSkill).toHaveBeenCalledWith(
      "migrations",
      "## Generating\nAsk the user to run it.",
      "New one",
    );
    expect(readLessons(file)).toEqual([]);
  });

  it("keeps a proposal whose save failed, and discards or ignores others", async () => {
    const agent = agentWith();
    agent.proposals = [skillProposal(), proposal()];
    const ctx = contextOf(agent);
    vi.mocked(ctx.skills.addToSkill).mockRejectedValueOnce(new Error("gone"));
    await expect(answerProposal(ctx, "c1", "s1", true, file)).rejects.toThrow(
      "gone",
    );
    expect(agent.proposals).toHaveLength(2);
    expect(await answerProposal(ctx, "c1", "nope", false, file)).toHaveLength(
      2,
    );
    expect(await answerProposal(ctx, "gone", "p1", true, file)).toEqual([]);
    expect(await answerProposal(ctx, "c1", "p1", false, file)).toHaveLength(1);
    expect(readLessons(file)).toEqual([]);
  });
});

describe("lessonHandlers", () => {
  it("lists, answers and removes", async () => {
    const agent = agentWith();
    agent.proposals = [proposal()];
    const ctx = contextOf(agent);
    expect(
      lessonHandlers.lesson_proposals(ctx, { session: "c1" }),
    ).toHaveLength(1);
    expect(lessonHandlers.lesson_proposals(ctx, { session: "gone" })).toEqual(
      [],
    );
    await lessonHandlers.lesson_answer(ctx, {
      session: "c1",
      lesson: "p1",
      keep: true,
    });
    const [saved] = lessonHandlers.lessons_list();
    expect(saved.text).toBe("Never force-push");
    expect(lessonHandlers.lessons_remove(ctx, { lesson: saved.id })).toEqual(
      [],
    );
  });
});
