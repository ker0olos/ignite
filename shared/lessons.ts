export const LESSON_ADD_TOOL = "lesson_add";
export const LESSON_REMOVE_TOOL = "lesson_remove";

/** A mistake the agent wrote down so it doesn't make it again. */
export type Lesson = {
  id: string;
  text: string;
  /** tool_call: shown when the agent calls `tool`; system_prompt: in every run's system prompt. */
  level: "tool_call" | "system_prompt";
  /** The exact tool name (`git`, `bash`, `mcp__github`) or MCP tool name (`create_issue`). */
  tool?: string;
  /** Text in the call's arguments that marks it as the mistake; such a call is always blocked. */
  match?: string;
  /** `match` is a JavaScript regex (`.` crossing lines), not plain text. */
  regex?: boolean;
  /** Set on save when the regex can take quadratic time: it sees only a call's start. */
  quadratic?: boolean;
  /** The folder it applies to; none for every folder. */
  folder?: string;
  hits: number;
  lastHit?: number;
};

/** A lesson_add result's details: the saved lesson, and the text of the one it replaced. */
export type LessonAdded = { lesson: Lesson; replaced?: string };

/** The lesson a lesson_add call saved; undefined for a declined replace, an older result or another tool. */
export function readLessonAdded(details: unknown): LessonAdded | undefined {
  const d = details as Partial<LessonAdded> | undefined;
  return typeof d?.lesson?.text === "string" ? (d as LessonAdded) : undefined;
}

export type LessonRequest =
  /** Every saved lesson, for Settings. */
  | { id: number; type: "lessons_list" }
  | { id: number; type: "lessons_remove"; lesson: string };

export type LessonResponses = {
  lessons_list: Lesson[];
  lessons_remove: Lesson[];
};
