import { describe, expect, it } from "vitest";
import type { AgentStatus } from "../../shared/hostProtocol";
import type { Task } from "../../shared/tasks";
import {
  ago,
  allImages,
  choicesOf,
  prLabel,
  taskFromDraft,
  taskImages,
  tasksLead,
  taskStatus,
  withStatus,
  workingLine,
  type ShownTask,
} from "./tasks";

const task: Task = {
  id: "t1",
  title: "Fix it",
  notes: "",
  images: [],
  subtasks: [],
  created: 1,
  updated: 1,
};
describe("allImages", () => {
  it("lists the user's images, then the agent's", () => {
    const image = (name: string) => ({
      type: "image" as const,
      data: "",
      mimeType: "image/png",
      name,
    });
    expect(allImages(task)).toEqual([]);
    const both = { ...task, images: [image("a")], shown: [image("b")] };
    expect(allImages(both).map((i) => i.name)).toEqual(["a", "b"]);
  });
});

const agent = (over: Partial<AgentStatus> = {}): AgentStatus => ({
  cwd: "/p",
  session: "s1",
  title: "Fix it",
  running: false,
  waiting: false,
  ...over,
});
const started = { ...task, session: "s1" };

describe("taskStatus", () => {
  it("is done once marked, whatever the agent does", () => {
    expect(
      taskStatus({ ...started, done: true }, agent({ running: true })),
    ).toBe("done");
  });
  it("is todo without a conversation", () => {
    expect(taskStatus(task)).toBe("todo");
  });
  it("is waiting when the agent waits on the user", () => {
    expect(taskStatus(started, agent({ waiting: true, running: true }))).toBe(
      "waiting",
    );
  });
  it("is working while running", () => {
    expect(taskStatus(started, agent({ running: true }))).toBe("working");
  });
  it("is working for a just-started agent with no title yet", () => {
    expect(taskStatus(started, agent({ title: "" }))).toBe("working");
  });
  it("is review when idle, or when its conversation is closed", () => {
    expect(taskStatus(started, agent())).toBe("review");
    expect(taskStatus(started)).toBe("review");
  });
  it("is declined when the user declined its pull request, until it runs again", () => {
    const declined = { ...started, declined: true };
    expect(taskStatus(declined)).toBe("declined");
    expect(taskStatus(declined, agent({ running: true }))).toBe("working");
  });
});

describe("withStatus", () => {
  it("matches each task to its conversation", () => {
    const other = { ...task, id: "t2" };
    const shown = withStatus(
      [started, other],
      [agent({ running: true }), agent({ session: "x", waiting: true })],
    );
    expect(shown.map((t) => t.status)).toEqual(["working", "todo"]);
  });

  it("shows a pull request waiting for approval as ready for review", () => {
    const review = { toolCallId: "c1" };
    const [waiting] = withStatus(
      [started],
      [agent({ waiting: true, running: true, review })],
    );
    expect(waiting).toMatchObject({ status: "review", review });
    const [done] = withStatus(
      [{ ...started, done: true }],
      [agent({ waiting: true, review })],
    );
    expect(done).not.toHaveProperty("review");
  });
});

describe("tasksLead", () => {
  const shown = (...status: ShownTask["status"][]): ShownTask[] =>
    status.map((s) => ({ ...task, status: s }));
  it("says nothing runs", () => {
    expect(tasksLead(shown("todo", "done"))).toBe("Nothing running");
  });
  it("counts running and waiting", () => {
    expect(tasksLead(shown("working", "working", "waiting"))).toBe(
      "2 running · 1 waiting on you",
    );
  });
  it("counts only what applies", () => {
    expect(tasksLead(shown("waiting"))).toBe("1 waiting on you");
  });
});

describe("taskImages", () => {
  it("reads images with their names and leaves other files out", async () => {
    const png = new File([new Uint8Array([1, 2, 3])], "a.png", {
      type: "image/png",
    });
    const text = new File(["hi"], "notes.txt", { type: "text/plain" });
    expect(await taskImages([png, text])).toEqual([
      { type: "image", data: "AQID", mimeType: "image/png", name: "a.png" },
    ]);
    expect(await taskImages(null)).toEqual([]);
  });
});

describe("choicesOf", () => {
  const state = {
    models: [],
    thinkingLevel: "high" as const,
    thinkingLevels: ["off" as const, "high" as const],
    skills: [],
  };

  it("keeps the shown model and effort", () => {
    const model = { provider: "p", id: "m", name: "M" };
    expect(choicesOf({ ...state, model })).toEqual({
      model: { provider: "p", id: "m" },
      effort: "high",
    });
  });

  it("keeps none while Model Router picks them", () => {
    const model = { provider: "p", id: "m", name: "M" };
    expect(choicesOf({ ...state, model }, true)).toEqual({});
  });

  it("keeps nothing without a model", () => {
    expect(choicesOf(state)).toEqual({});
    expect(choicesOf(null)).toEqual({});
  });

  it("goes into the new task", () => {
    const draft = { title: "T", notes: "", images: [], subtasks: [] };
    const t = taskFromDraft({
      ...draft,
      model: { provider: "p", id: "m" },
      effort: "low",
    });
    expect(t).toMatchObject({
      model: { provider: "p", id: "m" },
      effort: "low",
    });
    expect(taskFromDraft(draft)).not.toHaveProperty("model");
  });
});

describe("taskFromDraft", () => {
  it("trims and drops empty subtasks", () => {
    const t = taskFromDraft(
      { title: " A ", notes: " n ", images: [], subtasks: [" x ", "  ", ""] },
      5,
    );
    expect(t).toMatchObject({
      title: "A",
      notes: "n",
      subtasks: [{ title: "x", status: "todo" }],
      created: 5,
      updated: 5,
    });
    expect(t.session).toBeUndefined();
  });
});

describe("ago", () => {
  const now = 10_000_000_000;
  it.each([
    [0, "now"],
    [59_999, "now"],
    [60_000, "1m"],
    [59 * 60_000, "59m"],
    [60 * 60_000, "1h"],
    [23 * 3_600_000, "23h"],
    [24 * 3_600_000, "1d"],
    [49 * 3_600_000, "2d"],
  ])("%i ms ago is %s", (ms, text) => {
    expect(ago(now - ms, now)).toBe(text);
  });
});

describe("prLabel", () => {
  it("shows the number, or a generic label", () => {
    expect(prLabel("https://github.com/a/b/pull/41")).toBe("#41");
    expect(prLabel("https://github.com/a/b")).toBe("Pull request");
  });
});

describe("workingLine", () => {
  it("prefers the step, then the phase", () => {
    expect(workingLine({ ...task, step: "Editing a.ts", planned: true })).toBe(
      "Editing a.ts",
    );
    expect(workingLine({ ...task, planned: true })).toBe("Starting…");
    expect(workingLine(task)).toBe("Planning the subtasks");
  });
});

describe("taskStatus after a failed start", () => {
  it("is todo again when the task has an error and no conversation", () => {
    expect(taskStatus({ ...task, error: "No model" })).toBe("todo");
  });
});
