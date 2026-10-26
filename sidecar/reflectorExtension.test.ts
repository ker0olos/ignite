// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EntryPoint, Reflection } from "../shared/reflector.ts";
import reflector, {
  placeReflections,
  readReflections,
  writeReflections,
} from "./reflectorExtension.ts";

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "reflector-"));
  file = join(dir, "reflector.json");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const point = (entry: EntryPoint, text: string): Reflection => ({
  id: text,
  text,
  entry,
  taught: "note",
  at: 1,
});

it("reads and writes the points, none when missing or not a list, and only whole ones", () => {
  expect(readReflections(file)).toEqual([]);
  writeReflections([point("always", "Be brief.")], file);
  expect(readReflections(file)).toEqual([point("always", "Be brief.")]);
  writeFileSync(file, "{}");
  expect(readReflections(file)).toEqual([]);
  const good = point("always", "Be brief.");
  writeFileSync(
    file,
    JSON.stringify([
      good,
      { ...good, entry: "Asking" },
      { ...good, taught: undefined },
      { ...good, text: 3 },
      { ...good, when: 3 },
      { ...good, evidence: {} },
      null,
    ]),
  );
  expect(readReflections(file)).toEqual([good]);
});

describe("placeReflections", () => {
  const all = [
    point("always", "Be brief."),
    point("asking", "Ask one by one."),
    point("planning", "Subtasks first."),
    point("delivering", "Push to main."),
    point("delegating", "Explore first."),
  ];

  it("adds each point beside its entry point's guidance", () => {
    const sections: Record<string, string> = {
      questions: "Q",
      plan: "P",
      worktree: "W",
      subagents: "S",
    };
    placeReflections(sections, all, true);
    expect(sections.reflector).toContain("- Be brief.");
    expect(sections.questions).toMatch(/^Q\n\n.*\n- Ask one by one\.$/);
    expect(sections.plan).toContain("- Subtasks first.");
    expect(sections.worktree).toContain("- Push to main.");
    expect(sections.subagents).toContain("- Explore first.");
  });

  it("says when a point applies, but never its evidence", () => {
    const sections: Record<string, string> = {};
    const scoped = {
      ...all.find((p) => p.entry === "always")!,
      when: "reporting a review",
      evidence: "too long",
    };
    placeReflections(sections, [scoped], true);
    expect(sections.reflector).toContain(
      `- When reporting a review: ${scoped.text}`,
    );
    expect(sections.reflector).not.toContain("too long");
  });

  it("uses a task's section for planning, and leaves out what this conversation lacks", () => {
    const sections: Record<string, string> = { questions: "Q", task: "T" };
    placeReflections(sections, all.slice(1), false);
    expect(sections).toEqual({
      questions: "Q",
      task: expect.stringContaining("- Subtasks first."),
    });
  });
});

const loaded = (settings: string) => {
  let handler: (event: unknown) => Promise<void> = async () => {};
  const pi = {
    on: (_name: string, h: typeof handler) => (handler = h),
    getActiveTools: () => ["ask_user"],
  } as unknown as ExtensionAPI;
  reflector(pi, file, settings);
  return async () => {
    const sections: Record<string, string> = {};
    await handler({ systemPromptOptions: { sections } });
    return sections;
  };
};

it("places the points read once per conversation", async () => {
  writeReflections([point("always", "Be brief.")], file);
  const start = loaded(join(dirname(file), "settings.toml"));
  expect((await start()).reflector).toContain("Be brief.");
  writeReflections([], file);
  expect((await start()).reflector).toContain("Be brief.");
});

it("places nothing switched off", async () => {
  writeReflections([point("always", "Be brief.")], file);
  const settings = join(dirname(file), "settings.toml");
  writeFileSync(settings, "[reflector]\nenabled = false\n");
  expect(await loaded(settings)()).toEqual({});
});
