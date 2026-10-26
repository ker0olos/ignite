import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsSections } from "@/components/settings/SettingsSections";
import type { Item } from "@/components/settings/sections";
import { lessonsItems } from "@/components/settings/sections/lessonsItems";
import { reflectorItems } from "@/components/settings/sections/reflectorItems";
import type { Lesson } from "../../../shared/lessons";
import type { Reflection } from "../../../shared/reflector";

vi.mock("@/lib/lifecycle", () => ({ confirmNative: vi.fn() }));

const tabs = [
  { tab: "Memory", count: 4, on: true },
  { tab: "Lessons", count: 2, on: true },
  { tab: "Procedures", count: 0, on: false },
  { tab: "Reflector", on: true },
] as const;

const idle = { error: null, remove: vi.fn(), edit: vi.fn() };
const state = {
  query: "",
  setQuery: vi.fn(),
  filter: null,
  setFilter: vi.fn(),
};
const learn = {
  lessons: { ...idle, ...state, lessons: null },
  procedures: { ...idle, ...state, procedures: null },
  reflector: { ...idle, ...state, reflections: null },
} as { lessons: never; procedures: never; reflector: never };

const lesson = (id: string, folder?: string): Lesson => ({
  id,
  text: `Lesson ${id}`,
  level: "system_prompt",
  hits: 0,
  folder,
});

const point = (id: string, entry: Reflection["entry"]): Reflection => ({
  id,
  text: `Point ${id}`,
  entry,
  taught: "reply",
  at: 1,
});

function View({ tab }: { tab: "Lessons" | "Reflector" }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const common = { ...idle, query, setQuery, filter, setFilter };
  const lessons = {
    ...common,
    lessons: [lesson("a", "/p/tempo"), lesson("b", "/p/tempo"), lesson("c")],
  };
  const reflector = {
    ...common,
    reflections: [point("a", "delivering"), point("b", "always")],
  };
  const rows =
    tab === "Lessons"
      ? lessonsItems({ lessons: lessons as never })
      : reflectorItems({
          reflector: reflector as never,
          onOpenConversation: vi.fn(),
        });
  return (
    <SettingsSections
      query=""
      groups={[[tab, rows]]}
      mcp={{} as never}
      skills={{} as never}
      memory={{} as never}
      {...learn}
      lessons={lessons as never}
      reflector={reflector as never}
      folder={null}
      tabs={[...tabs]}
      onSectionChange={vi.fn()}
    />
  );
}

const chip = (name: RegExp) => screen.getByRole("button", { name });

describe("Learning filters", () => {
  it("filters lessons by folder chip and by search", () => {
    render(<View tab="Lessons" />);
    expect(chip(/^All\s*3$/).getAttribute("aria-pressed")).toBe("true");
    expect(chip(/^tempo\s*2$/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Every folder/ })).toBeNull();
    fireEvent.click(chip(/^tempo/));
    expect(screen.getByText("Lesson a")).toBeTruthy();
    expect(screen.queryByText("Lesson c")).toBeNull();
    fireEvent.click(chip(/^All/));
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search lessons" }),
      {
        target: { value: "nothing like it" },
      },
    );
    expect(screen.getByText("No lessons match.")).toBeTruthy();
    expect(chip(/^All\s*3$/)).toBeTruthy();
  });

  it("filters points by entry point chip", () => {
    render(<View tab="Reflector" />);
    expect(chip(/^In general\s*1$/)).toBeTruthy();
    fireEvent.click(chip(/^When delivering\s*1$/));
    expect(screen.getByText("Point a")).toBeTruthy();
    expect(screen.queryByText("Point b")).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search points" }), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("No points match.")).toBeTruthy();
  });

  it("shows neither while the list is empty", () => {
    render(
      <SettingsSections
        query=""
        groups={[["Lessons", []]]}
        mcp={{} as never}
        skills={{} as never}
        memory={{} as never}
        {...learn}
        lessons={{ ...idle, ...state, lessons: [] } as never}
        folder={null}
        tabs={[...tabs]}
        onSectionChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});

describe("Learning", () => {
  it("has one nav entry", () => {
    const onSectionChange = vi.fn();
    render(
      <SettingsNav
        search={{ current: null }}
        query=""
        onQueryChange={vi.fn()}
        section="Lessons"
        onSectionChange={onSectionChange}
        items={[]}
        matches={() => true}
      />,
    );
    expect(screen.getAllByText("Learning")).toHaveLength(1);
    for (const s of ["Memory", "Lessons", "Procedures", "Reflector"]) {
      expect(screen.queryByText(s)).toBeNull();
    }
    fireEvent.click(screen.getByText("Learning"));
    expect(onSectionChange).toHaveBeenCalledWith("Lessons");
  });

  it("shows tabs above the section's rows", () => {
    const onSectionChange = vi.fn();
    const rows: Item[] = [{ section: "Procedures", title: "A fix" }];
    render(
      <SettingsSections
        query=""
        groups={[["Procedures", rows]]}
        mcp={{} as never}
        skills={{} as never}
        memory={{} as never}
        {...learn}
        folder={null}
        tabs={[...tabs]}
        onSectionChange={onSectionChange}
      />,
    );
    expect(screen.getByRole("heading", { name: "Learning" })).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: /Memory/ }).textContent).toContain(
      "4",
    );
    expect(
      screen.getByRole("tab", { name: /Procedures/ }).textContent,
    ).toContain("off");
    expect(screen.getAllByText("off")).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: /Lessons/ }));
    expect(onSectionChange).toHaveBeenCalledWith("Lessons");
  });

  it("puts a section's switch in a card of its own, above its other rows", () => {
    const rows: Item[] = [
      { section: "Lessons", title: "Save lessons", alone: true },
      { section: "Lessons", title: "Run tests first" },
      { section: "Lessons", title: "Never force-push" },
    ];
    render(
      <SettingsSections
        query=""
        groups={[["Lessons", rows]]}
        mcp={{} as never}
        skills={{} as never}
        memory={{} as never}
        {...learn}
        folder={null}
        tabs={[...tabs]}
        onSectionChange={vi.fn()}
      />,
    );
    const card = (title: string) =>
      screen.getByText(title).closest(".rounded-lg");
    expect(card("Save lessons")).not.toBe(card("Run tests first"));
    expect(card("Run tests first")).toBe(card("Never force-push"));
    expect(card("Save lessons")?.textContent).toBe("Save lessons");
  });
});
