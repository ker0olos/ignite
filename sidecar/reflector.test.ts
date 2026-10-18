// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { AgentMessage } from "../shared/agentTypes.ts";
import type { Session } from "./hostTypes.ts";
import { parseProposals, reflect, reflectorInput } from "./reflector.ts";

const model = {
  provider: "x",
  id: "cheap",
  name: "Cheap",
  cost: { output: 1 },
};

const session = (complete: () => Promise<unknown>) => ({
  model,
  messages: [
    { role: "user", content: "ship it", timestamp: 1 },
  ] as AgentMessage[],
  modelRuntime: {
    getModels: () => [model],
    getAvailable: async () => [model],
    completeSimple: vi.fn(complete),
  } as unknown as Session["modelRuntime"],
});

const answer = (text: string, stopReason = "stop") => ({
  content: [{ type: "text", text }],
  stopReason,
});

describe("parseProposals", () => {
  it("reads lessons out of the reply, prose around them ignored", () => {
    const found = parseProposals(
      'Here: [{"text": "Never force-push", "level": "tool_call", "tool": "git", "match": "--force", "folder_only": true, "evidence": "denied push --force"},' +
        '{"text": "Answer in English", "level": "system_prompt"}] done',
    );
    expect(found).toMatchObject([
      {
        text: "Never force-push",
        level: "tool_call",
        tool: "git",
        match: "--force",
        folderOnly: true,
        evidence: "denied push --force",
      },
      {
        text: "Answer in English",
        level: "system_prompt",
        folderOnly: false,
        evidence: "",
      },
    ]);
    expect(found[0].id).not.toBe(found[1].id);
  });

  it("drops malformed lessons and too-short matches", () => {
    const found = parseProposals(
      JSON.stringify([
        { text: "no tool", level: "tool_call" },
        { text: "", level: "system_prompt" },
        { text: "odd level", level: "always", tool: "bash" },
        null,
        "text",
        {
          text: "Run tests first",
          level: "tool_call",
          tool: "git",
          match: "-m",
        },
      ]),
    );
    expect(found).toHaveLength(1);
    expect(found[0]).not.toHaveProperty("match");
  });

  it("proposes at most three, and none from a reply that isn't a JSON array", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      text: `lesson ${i}`,
      level: "system_prompt",
    }));
    expect(parseProposals(JSON.stringify(many))).toHaveLength(3);
    expect(parseProposals("nothing to learn")).toEqual([]);
    expect(parseProposals('[{"text": ')).toEqual([]);
    expect(parseProposals('{"a": [1]}')).toEqual([]);
  });
});

describe("reflectorInput", () => {
  it("lists existing lessons, the corrections and the run's end", () => {
    const messages = [
      { role: "user", content: "deploy", timestamp: 1 },
      { role: "custom", customType: "fork", content: "hidden", timestamp: 1 },
    ] as AgentMessage[];
    const input = reflectorInput(
      ["The user denied this call: git push"],
      messages,
      ["Never force-push"],
    );
    expect(input).toContain("- Never force-push");
    expect(input).toContain("- The user denied this call: git push");
    expect(input).toContain("[User]: deploy");
    expect(input).not.toContain("hidden");
    expect(reflectorInput([], [], [])).toContain("Existing lessons:\n(none)");
  });
});

describe("reflect", () => {
  it("proposes what the cheapest model found", async () => {
    const s = session(async () =>
      answer(
        '[{"text": "Ask before deleting", "level": "tool_call", "tool": "bash"}]',
      ),
    );
    const found = await reflect(s, ["denied rm -rf"], []);
    expect(found).toMatchObject([
      { text: "Ask before deleting", tool: "bash" },
    ]);
    expect(s.modelRuntime.completeSimple).toHaveBeenCalledWith(
      model,
      expect.objectContaining({
        systemPrompt: expect.stringContaining("corrected"),
      }),
      expect.objectContaining({ cacheRetention: "none" }),
    );
  });

  it("proposes nothing when the call fails, errors, or no model is priced", async () => {
    const failing = session(async () => {
      throw new Error("timed out");
    });
    expect(await reflect(failing, ["x"], [])).toEqual([]);
    expect(
      await reflect(
        session(async () => answer("[]", "error")),
        ["x"],
        [],
      ),
    ).toEqual([]);
    const unpriced = { ...session(async () => answer("[]")), model: undefined };
    expect(await reflect(unpriced, ["x"], [])).toEqual([]);
  });
});

describe("skill proposals", () => {
  const skills = ["migrations"];

  it("adds to a listed skill, or starts a new one when it has a description", () => {
    const found = parseProposals(
      JSON.stringify([
        { skill: "migrations", add: "## Generate\nAsk first.", evidence: "e" },
        {
          skill: "Release Notes!",
          description: "When writing release notes",
          add: "Keep it short.",
        },
      ]),
      skills,
    );
    expect(found).toMatchObject([
      {
        kind: "skill",
        skill: "migrations",
        add: "## Generate\nAsk first.",
        evidence: "e",
      },
      {
        kind: "skill",
        skill: "release-notes",
        description: "When writing release notes",
        add: "Keep it short.",
        evidence: "",
      },
    ]);
    expect(found[0]).not.toHaveProperty("description");
  });

  it("drops one with nothing to add, no usable name, or a new skill without a description", () => {
    const found = parseProposals(
      JSON.stringify([
        { skill: "migrations", add: " " },
        { skill: "!!!", description: "d", add: "x" },
        { skill: "unknown", add: "x" },
      ]),
      skills,
    );
    expect(found).toEqual([]);
  });

  it("lists the skills it may add to, with the content of used ones", () => {
    const input = reflectorInput(
      ["x"],
      [],
      [],
      [
        { name: "migrations", description: "DB changes", content: "# Steps" },
        { name: "idle", description: "Other" },
      ],
    );
    expect(input).toContain(
      "- migrations: DB changes\n  Its content now:\n# Steps",
    );
    expect(input).toContain("- idle: Other");
    expect(reflectorInput([], [], [])).toContain(
      "Skills you may add to:\n(none)",
    );
  });

  it("passes the skills' names along to parse the reply", async () => {
    const s = session(async () =>
      answer('[{"skill": "migrations", "add": "Ask first."}]'),
    );
    const found = await reflect(
      s,
      ["x"],
      [],
      [{ name: "migrations", description: "DB" }],
    );
    expect(found).toMatchObject([{ kind: "skill", skill: "migrations" }]);
  });
});

describe("regex proposals", () => {
  const lesson = (match: string) => ({
    text: `No ${match}`,
    level: "tool_call",
    tool: "git",
    match,
    regex: true,
  });

  it("keeps a regex, leaving its speed to Keep", () => {
    const found = parseProposals(
      JSON.stringify([lesson("push.*--force"), lesson("(a+)+$")]),
    );
    expect(found).toMatchObject([
      { match: "push.*--force", regex: true },
      { match: "(a+)+$", regex: true },
    ]);
  });

  it("only reminds when the regex is invalid or matches anything", () => {
    const found = parseProposals(
      JSON.stringify([lesson("push("), lesson("^.*")]),
    );
    expect(found.map((p) => p.kind === "lesson" && p.text)).toEqual([
      "No push(",
      "No ^.*",
    ]);
    for (const p of found) expect(p).not.toHaveProperty("match");
  });
});
