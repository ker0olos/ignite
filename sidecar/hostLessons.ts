import type { HostContext } from "./hostTypes.ts";
import { LESSONS_FILE } from "./lessonExtension.ts";
import { readLessons, removeLesson } from "./lessons.ts";

/** Settings' saved lessons: list and remove. */
export const lessonHandlers = {
  lessons_list: () => readLessons(LESSONS_FILE),
  lessons_remove: (_ctx: HostContext, r: { lesson: string }) => {
    removeLesson(LESSONS_FILE, r.lesson);
    return readLessons(LESSONS_FILE);
  },
};
