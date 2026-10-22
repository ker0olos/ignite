// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { AgentMessage } from "../shared/agentTypes.ts";
import type { Reflection } from "../shared/reflector.ts";
import type { Session } from "./hostTypes.ts";
import { parsePoints, reflect, reflectorInput } from "./reflector.ts";

const model = {
  provider: "x",
  id: "cheap",
  name: "Cheap",
  cost: { output: 1 },
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

const reply = (points: object[]) => JSON.stringify({ points });

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

  it("keeps at most 10 per entry point, the first ones", () => {
    const many = (entry: string) =>
      Array.from({ length: 12 }, (_, i) => ({ entry, text: `${entry} ${i}` }));
    const next = parsePoints(reply([...many("asking"), ...many("always")]), []);
    expect(next?.filter((p) => p.entry === "asking")).toHaveLength(10);
    expect(next?.filter((p) => p.entry === "always")).toHaveLength(10);
    expect(next?.[9].text).toBe("asking 9");
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
});

describe("reflect", () => {
  it("returns the cheapest model's points", async () => {
    const s = runtime(async () =>
      answer(reply([{ entry: "planning", text: "Plan first." }])),
    );
    expect(await reflect(s, ["f"], messages, [])).toMatchObject([
      { entry: "planning", text: "Plan first." },
    ]);
    const [, , options] = vi.mocked(s.modelRuntime.completeSimple).mock
      .calls[0] as unknown as [unknown, unknown, { cacheRetention: string }];
    expect(options.cacheRetention).toBe("none");
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
