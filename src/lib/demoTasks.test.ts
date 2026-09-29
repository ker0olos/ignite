import { describe, expect, it } from "vitest";
import type { Task } from "../../shared/tasks";
import { shownRows } from "./demo";
import { demoConversations } from "./demoConversations";
import { demoTasks, tasksAnswers } from "./demoTasks";
import { withStatus } from "./tasks";

const tempo = "/demo/tempo";
const byFolder = demoTasks(tempo);

describe("demoTasks", () => {
  it("points each started task at a conversation in its folder", () => {
    const conversations = demoConversations(tempo);
    for (const [cwd, tasks] of Object.entries(byFolder)) {
      for (const task of tasks.filter((t) => t.session)) {
        const c = conversations.find((c) => c.id === task.session);
        expect(c?.cwd, task.id).toBe(cwd);
      }
    }
  });

  it("shows every status in Tempo, from its conversations", () => {
    const rows = shownRows(() => [], tempo)(tempo);
    const statuses = withStatus(byFolder[tempo], rows).map((t) => t.status);
    expect(new Set(statuses)).toEqual(
      new Set(["waiting", "working", "review", "todo", "done"]),
    );
  });

  it("draws its images as SVG", () => {
    const images = Object.values(byFolder).flatMap((tasks) =>
      tasks.flatMap((t) => t.images),
    );
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image.mimeType).toBe("image/svg+xml");
      expect(atob(image.data)).toMatch(/^<svg /);
    }
  });
});

describe("tasksAnswers", () => {
  const task = (id: string, title = id): Task => ({
    id,
    title,
    notes: "",
    images: [],
    subtasks: [],
    created: 0,
    updated: 0,
  });

  it("adds, replaces, deletes and lists in memory; starting runs nothing", () => {
    const answers = tasksAnswers({});
    expect(answers.tasks_list({ cwd: "/a" })).toEqual([]);
    answers.task_save({ cwd: "/a", task: task("1") });
    answers.task_save({ cwd: "/a", task: task("2") });
    answers.task_save({ cwd: "/a", task: task("1", "new") });
    expect(answers.task_delete({ cwd: "/a", taskId: "2" })).toEqual([
      task("1", "new"),
    ]);
    expect(answers.task_start({ cwd: "/a" })).toEqual([task("1", "new")]);
  });
});
