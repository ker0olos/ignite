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
  /** The folder it applies to; none for every folder. */
  folder?: string;
  hits: number;
  lastHit?: number;
};

/** A lesson the reflector draws from a run the user corrected; saved only if the user keeps it. */
export type ProposedLesson = Pick<
  Lesson,
  "id" | "text" | "level" | "tool" | "match"
> & {
  folderOnly: boolean;
  /** The moment in the run that calls for it. */
  evidence: string;
};

export type LessonRequest =
  /** The conversation's proposed lessons. */
  | { id: number; type: "lesson_proposals"; session: string }
  /** Saves (`keep`) or discards one; resolves to those left. */
  | {
      id: number;
      type: "lesson_answer";
      session: string;
      lesson: string;
      keep: boolean;
    }
  /** Every saved lesson, for Settings. */
  | { id: number; type: "lessons_list" }
  | { id: number; type: "lessons_remove"; lesson: string };

export type LessonResponses = {
  lesson_proposals: ProposedLesson[];
  lesson_answer: ProposedLesson[];
  lessons_list: Lesson[];
  lessons_remove: Lesson[];
};

/** The lessons the reflector proposes for a conversation changed. */
export type LessonMessage = {
  type: "lesson_proposals";
  session: string;
  lessons: ProposedLesson[];
};
