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

/** A lesson the reflector draws from a run the user corrected; saved only if the user keeps it. */
export type ProposedLesson = Pick<
  Lesson,
  "id" | "text" | "level" | "tool" | "match" | "regex"
> & {
  kind: "lesson";
  folderOnly: boolean;
  /** The moment in the run that calls for it. */
  evidence: string;
};

/** A section the reflector would add to one of the app's skills, or a new skill with it. */
export type ProposedSkill = {
  kind: "skill";
  id: string;
  skill: string;
  /** Set for a new skill: when the agent should load it. */
  description?: string;
  /** Markdown added at the end of the skill. */
  add: string;
  evidence: string;
};

export type Proposal = ProposedLesson | ProposedSkill;

export type LessonRequest =
  /** The conversation's proposals. */
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
  lesson_proposals: Proposal[];
  lesson_answer: Proposal[];
  lessons_list: Lesson[];
  lessons_remove: Lesson[];
};

/** The reflector's proposals for a conversation changed. */
export type LessonMessage = {
  type: "lesson_proposals";
  session: string;
  lessons: Proposal[];
};
