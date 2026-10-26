import { describe, expect, it } from "vitest";
import { learningTabs } from "./learning";

const on = { enabled: true };
const settings = { memory: on, lessons: on, procedures: on, reflector: on };
const none = {
  memory: { status: null },
  lessons: { lessons: null },
  procedures: { procedures: null },
  reflector: { reflections: null },
};

describe("learningTabs", () => {
  it("leaves counts out until loaded", () => {
    expect(learningTabs(settings, none, null).map((t) => t.count)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("counts memory by type and the others by list", () => {
    const tabs = learningTabs(
      settings,
      {
        memory: {
          status: { counts: { bugfix: 2, change: 3 }, observations: [] },
        },
        lessons: { lessons: [1] },
        procedures: { procedures: [] },
        reflector: { reflections: [1, 2] },
      },
      "/work/app",
    );
    expect(tabs.map((t) => [t.tab, t.count, t.on])).toEqual([
      ["Memory", 5, true],
      ["Lessons", 1, true],
      ["Procedures", 0, true],
      ["Reflector", 2, true],
    ]);
  });

  it("counts no memories with no folder open, as it counts the open folder's", () => {
    const status = { counts: { bugfix: 2 }, observations: [] };
    const [memory] = learningTabs(
      settings,
      { ...none, memory: { status } },
      null,
    );
    expect(memory.count).toBeUndefined();
  });

  it("turns procedures off with memory", () => {
    const tabs = learningTabs(
      { ...settings, memory: { enabled: false } },
      none,
      null,
    );
    expect(tabs.map((t) => t.on)).toEqual([false, true, false, true]);
  });
});
