// @vitest-environment node
import { rmSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HostContext } from "./hostTypes.ts";
import { lessonHandlers } from "./hostLessons.ts";
import { addLesson } from "./lessons.ts";

const { file } = vi.hoisted(() => ({
  file: `${process.env.TMPDIR ?? "/tmp"}/host-lessons-${process.pid}.json`,
}));
vi.mock("./lessonExtension.ts", () => ({ LESSONS_FILE: file }));

afterEach(() => rmSync(file, { force: true }));

describe("lessonHandlers", () => {
  it("lists and removes", () => {
    addLesson(file, { text: "Never force-push", level: "system_prompt" });
    const [saved] = lessonHandlers.lessons_list();
    expect(saved.text).toBe("Never force-push");
    expect(
      lessonHandlers.lessons_remove({} as HostContext, { lesson: saved.id }),
    ).toEqual([]);
  });
});
