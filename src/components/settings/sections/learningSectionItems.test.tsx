import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { learningSectionItems } from "./learningSectionItems";

const hooks = () => ({
  memory: { status: null, error: null, changed: vi.fn() } as never,
  lessons: {
    lessons: [
      { id: "a", text: "Run tests first", level: "system_prompt", hits: 0 },
    ],
    error: null,
    remove: vi.fn(),
    query: "nothing like it",
    filter: null,
  } as never,
  procedures: { procedures: [], error: null, query: "", filter: null } as never,
  reflector: { reflections: [], error: null, query: "", filter: null } as never,
});

const titles = (query: string) =>
  learningSectionItems(hooks(), {
    settings: DEFAULT_SETTINGS,
    onChange: vi.fn(),
    onOpenConversation: vi.fn(),
    folder: null,
    query,
  })
    .filter((i) => i.section === "Lessons")
    .map((i) => i.title);

describe("learningSectionItems", () => {
  it("applies a tab's own search, but not while Settings itself is searched", () => {
    expect(titles("")).toContain("No lessons match.");
    expect(titles("tests")).toContain("Run tests first");
    expect(titles("tests")).not.toContain("No lessons match.");
  });
});
