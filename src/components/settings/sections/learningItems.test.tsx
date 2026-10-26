import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings";
import { learningItems } from "./learningItems";

const items = (settings: Settings = DEFAULT_SETTINGS) => {
  const onChange = vi.fn(async () => {});
  const onLessonsChanged = vi.fn(async () => {});
  return {
    rows: learningItems({ settings, onChange, onLessonsChanged }),
    onChange,
    onLessonsChanged,
  };
};

describe("learningItems", () => {
  it("gives Lessons, Procedures and Reflector a switch each, on by default", () => {
    const { rows } = items();
    expect(rows.map((r) => r.section)).toEqual([
      "Lessons",
      "Procedures",
      "Reflector",
    ]);
    expect(rows.every((r) => r.title === r.section)).toBe(true);
    expect(rows[0].description).toMatch(/^The agent saves a lesson/);
  });

  it("says what's off, and that procedures need memory", () => {
    const off = {
      ...DEFAULT_SETTINGS,
      lessons: { enabled: false },
      reflector: { enabled: false },
    };
    const [lessons, , reflector] = items(off).rows;
    expect(lessons.description).toMatch(/^Off: no lessons are saved/);
    expect(reflector.description).toMatch(/^Off: nothing new is learned/);
    const noMemory = { ...DEFAULT_SETTINGS, memory: { enabled: false } };
    expect(items(noMemory).rows[1].description).toMatch(/^Needs Memory on/);
  });

  it("saves a switch, and reloads conversations for lessons' tools", async () => {
    const { rows, onChange, onLessonsChanged } = items();
    render(<>{rows[0].control}</>);
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(onLessonsChanged).toHaveBeenCalledOnce());
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      lessons: { enabled: false },
    });
  });

  it("saves the reflector's and procedures' switches, which apply from the next run", async () => {
    const { rows, onChange, onLessonsChanged } = items();
    render(
      <>
        {rows[1].control}
        {rows[2].control}
      </>,
    );
    const [procedures, reflector] = screen.getAllByRole("switch");
    fireEvent.click(procedures);
    fireEvent.click(reflector);
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      procedures: { enabled: false },
    });
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      reflector: { enabled: false },
    });
    expect(onLessonsChanged).not.toHaveBeenCalled();
  });
});
