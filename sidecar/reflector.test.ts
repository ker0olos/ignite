// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { AgentMessage } from "../shared/agentTypes.ts";
import type { Reflection } from "../shared/reflector.ts";
import type { Session } from "./hostTypes.ts";
import { parsePoints, reflect, reflectorInput } from "./reflector.ts";
import { groundedIn } from "./reflectorCheck.ts";

const model = {
  provider: "x",
  id: "cheap",
  name: "Cheap",
  cost: { output: 1 },
  input: ["text"],
};

const runtime = (complete: () => Promise<unknown>) => ({
  model,
  modelRuntime: {
    getModels: () => [model],
    getAvailable: async () => [model],
    completeSimple: vi.fn(complete),
  } as unknown as Session["modelRuntime"],
});

const messages = [
  { role: "user", content: "triage sentry", timestamp: 1 },
] as AgentMessage[];

const answer = (text: string, stopReason = "stop") => ({
  content: [{ type: "text", text }],
  stopReason,
});

const short: Reflection = {
  id: "r1",
  text: "Keep reports short.",
  entry: "always",
  taught: "note",
  at: 1,
};

// New points carry the user's words, which they must; a test's own evidence stays.
const reply = (points: unknown[], evidence = "said so") =>
  JSON.stringify({
    points: points.map((p) =>
      !p || typeof p !== "object" || "id" in p || "evidence" in p
        ? p
        : { ...p, evidence },
    ),
  });

describe("parsePoints", () => {
  it("keeps, changes and adds points, prose around the JSON ignored", () => {
    const next = parsePoints(
      `Here: ${reply([
        { entry: "asking", text: "Ask one by one.", taught: "note" },
        { id: "r1" },
      ])} done`,
      [short],
      { at: 5 },
    );
    expect(next?.[0]).toMatchObject({
      entry: "asking",
      text: "Ask one by one.",
      taught: "note",
      at: 5,
    });
    expect(next?.[0].id).not.toBe("r1");
    expect(next?.[1]).toBe(short);
    const changed = parsePoints(
      reply([{ id: "r1", entry: "always", text: "Keep reports to 5 lines." }]),
      [short],
      { at: 5 },
    );
    expect(changed).toEqual([
      { ...short, text: "Keep reports to 5 lines.", at: 5 },
    ]);
  });

  it("drops invalid points and repeats, and defaults what taught a new one", () => {
    const next = parsePoints(
      reply([
        { entry: "everywhere", text: "x" },
        { entry: "asking", text: "" },
        { entry: "asking", text: "y".repeat(401) },
        null,
        { id: "r1" },
        { id: "r1" },
        { entry: "planning", text: "Plan first.", taught: "magic" },
      ]),
      [short],
    );
    expect(next).toHaveLength(2);
    expect(next?.[1]).toMatchObject({ text: "Plan first.", taught: "reply" });
  });

  it("ignores a point whose words aren't the user's, and keeps the point it would change", () => {
    const heard = groundedIn(["Whats taking this long??", "keep it short"]);
    const next = parsePoints(
      JSON.stringify({
        points: [
          {
            entry: "always",
            text: "Report progress on long jobs.",
            evidence: "whats taking this long",
          },
          {
            entry: "asking",
            text: "Never ask.",
            evidence: "user prefers this",
          },
          { id: "r1", text: "Never report.", evidence: "made up" },
        ],
      }),
      [short],
      undefined,
      heard,
    );
    expect(next?.map((p) => p.text)).toEqual([
      "Report progress on long jobs.",
      short.text,
    ]);
    expect(heard("")).toBe(false);
  });

  it("ignores a new point without the user's words, never a changed one", () => {
    const next = parsePoints(
      reply(
        [
          { entry: "asking", text: "Never ask first." },
          { id: "r1", text: "Keep reports to 3 lines." },
        ],
        "",
      ),
      [short],
    );
    expect(next).toEqual([
      expect.objectContaining({ id: "r1", text: "Keep reports to 3 lines." }),
    ]);
  });

  it("records the conversation a new or changed point was learned in, not a kept one", () => {
    const from = {
      conversation: "c1",
      folder: "/work",
      title: "Sentry triage",
    };
    const next = parsePoints(
      reply([{ id: "r1" }, { entry: "asking", text: "Ask one by one." }]),
      [short],
      { at: 5, from },
    );
    expect(next?.[0]).toBe(short);
    expect(next?.[1]).toMatchObject({ at: 5, from });
  });

  it("keeps points the reply leaves out, after the others; only a drop removes one", () => {
    const other = {
      ...short,
      id: "r2",
      text: "Plan first.",
      entry: "planning" as const,
    };
    const next = parsePoints(
      reply([
        { entry: "asking", text: "Ask one by one." },
        { id: "r1", drop: true },
      ]),
      [short, other],
      { at: 5 },
    );
    expect(next?.map((p) => p.text)).toEqual([
      "Ask one by one.",
      "Plan first.",
    ]);
    expect(next?.[1]).toBe(other);
  });

  it("changes a point's text keeping its entry point when the reply leaves it out", () => {
    expect(
      parsePoints(
        reply([{ id: "r1", text: "Keep reports to 5 lines." }]),
        [short],
        {
          at: 5,
        },
      ),
    ).toEqual([{ ...short, text: "Keep reports to 5 lines.", at: 5 }]);
  });

  it("adds to a full entry point only in place of a drop, never evicting a point unasked", () => {
    const asking = Array.from({ length: 10 }, (_, i) => ({
      ...short,
      id: `a${i}`,
      entry: "asking" as const,
      text: `asking ${i}`,
    }));
    const add = { entry: "asking", text: "Ask one by one." };
    expect(parsePoints(reply([add]), asking)).toBeUndefined();
    const next = parsePoints(reply([add, { id: "a3", drop: true }]), asking);
    expect(next).toHaveLength(10);
    expect(next?.[0].text).toBe("Ask one by one.");
    expect(next?.some((p) => p.id === "a3")).toBe(false);
  });

  it("spends no edit on a point already handled, and keeps one past the budget", () => {
    const other = { ...short, id: "r2", text: "Plan first." };
    const next = parsePoints(
      reply([
        { id: "r1" },
        { id: "r1", text: "x" },
        { id: "r1", drop: true },
        { entry: "always", text: "One." },
        { entry: "always", text: "Two." },
        { entry: "always", text: "Three." },
        { id: "r2", drop: true },
      ]),
      [short, other],
    );
    expect(next?.map((p) => p.text)).toEqual([
      "Keep reports short.",
      "One.",
      "Two.",
      "Three.",
      "Plan first.",
    ]);
  });

  it("makes at most 3 edits a reply, in its order; past them points stay as they were", () => {
    const other = { ...short, id: "r2", text: "Plan first." };
    const next = parsePoints(
      reply([
        { entry: "always", text: "One." },
        { id: "r1", drop: true },
        { entry: "always", text: "Two." },
        { entry: "always", text: "Three." },
        { id: "r2", text: "Plan before every edit." },
      ]),
      [short, other],
    );
    expect(next?.map((p) => p.text)).toEqual(["One.", "Two.", "Plan first."]);
    expect(next?.[2]).toBe(other);
  });

  it("returns nothing when unchanged, or the reply isn't the points", () => {
    expect(parsePoints("UNCHANGED", [short])).toBeUndefined();
    expect(parsePoints(reply([{ id: "r1" }]), [short])).toBeUndefined();
    expect(
      parsePoints(reply([{ id: "r1", entry: "always", text: short.text }]), [
        short,
      ]),
    ).toBeUndefined();
    expect(parsePoints("no json", [short])).toBeUndefined();
    expect(parsePoints('{"points": 3}', [short])).toBeUndefined();
  });

  it("takes when a point applies and the words that taught it", () => {
    const [added] = parsePoints(
      reply([
        {
          entry: "asking",
          text: "Ask one decision per question.",
          when: " several things need acting on ",
          evidence: "one at a time please",
        },
      ]),
      [],
    )!;
    expect(added).toMatchObject({
      when: "several things need acting on",
      evidence: "one at a time please",
    });
    // Too long, an evidence is cut.
    const [long] = parsePoints(
      reply([{ entry: "always", text: "x", evidence: "e".repeat(400) }]),
      [],
    )!;
    expect(long.evidence).toHaveLength(300);
  });

  it("refuses a new point whose when is too long, rather than let it apply to all work", () => {
    const tooLong = {
      entry: "always",
      text: "One line.",
      when: "w".repeat(201),
    };
    expect(parsePoints(reply([tooLong]), [])).toBeUndefined();
    // A changed point keeps its own when.
    const scoped = { ...short, when: "reporting" };
    const [changed] = parsePoints(
      reply([{ id: "r1", text: "Shorter.", when: "w".repeat(201) }]),
      [scoped],
    )!;
    expect(changed).toMatchObject({ text: "Shorter.", when: "reporting" });
  });

  it("writes a when as the prompt reads it after When: one line, no When or colon of its own", () => {
    const [added] = parsePoints(
      reply([
        {
          entry: "always",
          text: "Lead with the verdict.",
          when: " When reporting\n several findings: ",
        },
      ]),
      [],
    )!;
    expect(added.when).toBe("reporting several findings");
  });

  it("keeps a changed point's when and evidence unless given new ones; an empty when clears it", () => {
    const scoped = { ...short, when: "reporting", evidence: "shorter" };
    const [changed] = parsePoints(
      reply([{ id: "r1", text: "Keep reports to 5 lines." }]),
      [scoped],
      { at: 5 },
    )!;
    expect(changed).toMatchObject({ when: "reporting", evidence: "shorter" });
    const [cleared] = parsePoints(reply([{ id: "r1", when: "" }]), [scoped])!;
    expect(cleared.when).toBeUndefined();
    expect(cleared.text).toBe(scoped.text);
    const [narrowed] = parsePoints(
      reply([{ id: "r1", when: "reporting a review" }]),
      [scoped],
    )!;
    expect(narrowed.when).toBe("reporting a review");
  });

  it("spends no edit on new evidence alone, which changes nothing the agent reads", () => {
    expect(
      parsePoints(reply([{ id: "r1", text: short.text, evidence: "new" }]), [
        short,
      ]),
    ).toBeUndefined();
  });

  it("keeps a folder-only point to the folder it was learned in, until told it holds for every folder", () => {
    const from = { conversation: "c1", folder: "/work/app", title: "t" };
    const [added] = parsePoints(
      reply([{ entry: "delivering", text: "Show it, then PR.", folder: true }]),
      [],
      { at: 5, from },
    )!;
    expect(added.folder).toBe("/work/app");
    const [kept] = parsePoints(
      reply([{ id: added.id, text: "Show it, then PR, then comment." }]),
      [added],
    )!;
    expect(kept.folder).toBe("/work/app");
    const [everywhere] = parsePoints(reply([{ id: added.id, folder: false }]), [
      added,
    ])!;
    expect(everywhere.folder).toBeUndefined();
    expect(everywhere.text).toBe(added.text);
  });

  it("never pulls a point learned in another folder into this one", () => {
    const elsewhere = {
      ...short,
      from: { conversation: "c0", folder: "/work/other", title: "t" },
    };
    const from = { conversation: "c1", folder: "/work/app", title: "t" };
    expect(
      parsePoints(reply([{ id: "r1", folder: true }]), [elsewhere], {
        at: 5,
        from,
      }),
    ).toBeUndefined();
  });

  it("keeps every point already there past the cap, which other folders' reflections can fill", () => {
    const full = Array.from({ length: 12 }, (_, i) => ({
      ...short,
      id: `a${i}`,
    }));
    const next = parsePoints(
      reply([
        { id: "a0", text: "Keep reports to 5 lines." },
        { entry: "always", text: "New." },
      ]),
      full,
    );
    expect(next?.map((p) => p.id)).toEqual(full.map((p) => p.id));
    expect(next?.[0].text).toBe("Keep reports to 5 lines.");
  });

  it("can drop every point, but an empty reply keeps them", () => {
    expect(parsePoints(reply([{ id: "r1", drop: true }]), [short])).toEqual([]);
    expect(parsePoints(reply([]), [short])).toBeUndefined();
  });
});

describe("reflectorInput", () => {
  it("gives the points with their ids and entry points, the feedback and the run", () => {
    const input = reflectorInput(["The user wrote: shorter"], messages, [
      short,
    ]);
    expect(input).toContain("- [r1] (always) Keep reports short.");
    expect(input).toContain("- The user wrote: shorter");
    expect(input).toContain("triage sentry");
    expect(reflectorInput([], [], [])).toContain("The points:\n(none)");
  });

  it("tags folder-only points, and lists what the user asked in the folder's other conversations", () => {
    const input = reflectorInput(
      [],
      [],
      [{ ...short, folder: "/work" }],
      [["work on 4", "ok pr"]],
    );
    expect(input).toContain("- [r1] (always, this folder) Keep reports short.");
    expect(input).toContain("Conversation 1:\n- work on 4\n- ok pr");
    expect(reflectorInput([], [], [])).toContain(
      "other recent conversations:\n(none)",
    );
  });

  it("lists a point's when and evidence", () => {
    const scoped = { ...short, when: "reporting", evidence: "too long" };
    expect(reflectorInput([], [], [scoped])).toContain(
      '- [r1] (always) Keep reports short. · when: reporting · taught by: "too long"',
    );
  });

  it("reads the whole conversation, private text left out; a long one as its opening and its end", () => {
    const say = (content: string, timestamp: number) =>
      ({ role: "user", content, timestamp }) as AgentMessage;
    const kept = reflectorInput([], [say("a <private>key</private> b", 1)], []);
    expect(kept).toContain("a [private] b");
    expect(kept).not.toContain("key");
    const filler = (n: number) =>
      Array.from({ length: n }, (_, i) => say("x".repeat(5000), i + 2));
    const long = [
      say("the request", 1),
      ...filler(3),
      say("the middle", 50),
      ...filler(25),
      say("the end", 99),
    ];
    const cut = reflectorInput([], long, []);
    expect(cut).toContain("the request");
    expect(cut).toContain("[…]");
    expect(cut).toContain("the end");
    expect(cut).not.toContain("the middle");
    expect(cut.length).toBeLessThan(101_000);
  });
});

describe("reflect", () => {
  it("returns the cheapest model's points, grounded in the feedback it was given", async () => {
    const s = runtime(async (...args: unknown[]) =>
      (args[1] as { systemPrompt: string }).systemPrompt.includes(
        "taught by the user's own words",
      )
        ? answer("faithful")
        : answer(
            reply([
              {
                entry: "planning",
                text: "Plan first.",
                evidence: "plan it first",
              },
              { entry: "asking", text: "Never ask." },
            ]),
          ),
    );
    expect(await reflect(s, ["Plan it first!"], messages, [])).toEqual([
      expect.objectContaining({ entry: "planning", text: "Plan first." }),
    ]);
    const [, context, options] = vi.mocked(s.modelRuntime.completeSimple).mock
      .calls[0] as unknown as [
      unknown,
      { systemPrompt: string },
      { cacheRetention: string },
    ];
    expect(options.cacheRetention).toBe("none");
    // It reads the whole conversation, so earlier feedback isn't new.
    expect(context.systemPrompt).toContain("Only the feedback listed is new");
  });

  it("keeps only the points a second read finds faithful to the user's words", async () => {
    const verdicts: Record<string, string> = {
      "Plan first.": "faithful",
      "Always use the user's Chrome.": "wider",
      "Keep reports to one line.": "against",
    };
    const s = runtime(async (...args: unknown[]) => {
      const { systemPrompt, messages: asked } = args[1] as {
        systemPrompt: string;
        messages: { content: string | { text: string }[] }[];
      };
      if (!systemPrompt.includes("taught by the user's own words"))
        return answer(
          reply([
            { entry: "planning", text: "Plan first.", evidence: "plan it" },
            {
              entry: "always",
              text: "Always use the user's Chrome.",
              evidence: "see the fix",
            },
            { id: "r1", text: "Keep reports to one line.", evidence: "short" },
          ]),
        );
      const content = asked[0]!.content;
      const text = typeof content === "string" ? content : content[0]!.text;
      const point = Object.keys(verdicts).find((p) => text.includes(p))!;
      return answer(verdicts[point]!);
    });
    const feedback = ["plan it", "i need to see the fix", "too short"];
    expect(await reflect(s, feedback, messages, [short])).toEqual([
      expect.objectContaining({ text: "Plan first." }),
      short,
    ]);
  });

  it("checks only words from this run: a point keeping older evidence isn't", async () => {
    const earlier = { ...short, evidence: "keep it short" };
    const s = runtime(async (...args: unknown[]) =>
      (args[1] as { systemPrompt: string }).systemPrompt.includes(
        "taught by the user's own words",
      )
        ? answer("wider")
        : answer(reply([{ id: "r1", when: "reporting" }])),
    );
    expect(await reflect(s, ["ok, pr it"], messages, [earlier])).toEqual([
      expect.objectContaining({ id: "r1", when: "reporting" }),
    ]);
  });

  it("returns nothing when the check turns every edit back", async () => {
    const s = runtime(async (...args: unknown[]) =>
      (args[1] as { systemPrompt: string }).systemPrompt.includes(
        "taught by the user's own words",
      )
        ? answer("task")
        : answer(reply([{ id: "r1", text: "Short.", evidence: "short" }])),
    );
    expect(await reflect(s, ["short"], messages, [short])).toBeUndefined();
  });

  it("reads an unclear check as wider, but keeps the point when the check fails", async () => {
    const edit = reply([{ id: "r1", text: "Short.", evidence: "short" }]);
    const checking = (args: unknown[]) =>
      (args[1] as { systemPrompt: string }).systemPrompt.includes(
        "taught by the user's own words",
      );
    const unclear = runtime(async (...args: unknown[]) =>
      answer(checking(args) ? "faithful-ish" : edit),
    );
    expect(
      await reflect(unclear, ["short"], messages, [short]),
    ).toBeUndefined();
    const failing = runtime(async (...args: unknown[]) =>
      checking(args) ? answer("", "error") : answer(edit),
    );
    expect(await reflect(failing, ["short"], messages, [short])).toEqual([
      expect.objectContaining({ id: "r1", text: "Short." }),
    ]);
  });

  it("returns nothing when the call errors or fails", async () => {
    const errored = runtime(async () => answer(reply([]), "error"));
    expect(await reflect(errored, ["f"], messages, [short])).toBeUndefined();
    const failed = runtime(async () => {
      throw new Error("offline");
    });
    expect(await reflect(failed, ["f"], messages, [short])).toBeUndefined();
  });

  it("returns nothing without a priced model", async () => {
    const s = {
      model: { ...model, cost: undefined },
      modelRuntime: {
        getModels: () => [],
        getAvailable: async () => [],
      } as unknown as Session["modelRuntime"],
    } as unknown as Pick<Session, "model" | "modelRuntime">;
    expect(await reflect(s, ["f"], messages, [])).toBeUndefined();
  });
});
