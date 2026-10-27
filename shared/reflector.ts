/** The reflector's points: how the user wants the agent to work, each read where it applies (used by both). */

/** Where a point is read: beside the guidance of the work it's about. */
export type EntryPoint =
  "always" | "asking" | "planning" | "delivering" | "delegating";

export const ENTRY_POINTS: Record<
  EntryPoint,
  { label: string; where: string }
> = {
  always: { label: "In general", where: "In the system prompt, for all work" },
  asking: { label: "When asking", where: "Beside ask_user's instructions" },
  planning: {
    label: "When planning",
    where: "Beside task_update's instructions",
  },
  delivering: {
    label: "When delivering",
    where: "Beside the git tool's instructions",
  },
  delegating: {
    label: "When delegating",
    where: "Beside the subagent tool's instructions",
  },
};

/** The kind of feedback that taught a point; "edit" when the user wrote it in Settings. */
export type Taught = "reply" | "note" | "denial" | "rewind" | "edit";

export const TAUGHT_BY: Record<Taught, string> = {
  reply: "Reply",
  note: "Note on an answer",
  denial: "Denied call",
  rewind: "Rewind",
  edit: "Your edit",
};

export type Reflection = {
  id: string;
  text: string;
  entry: EntryPoint;
  taught: Taught;
  /** When it was learned or last changed (ms). */
  at: number;
  /** The situation it applies in, read after "When" ("reporting several findings"); none when it always does. */
  when?: string;
  /** The user's own words that taught it, for the reflector and Settings; never in the agent's prompt. */
  evidence?: string;
  /** The only folder it applies in (its own way of working); none for all folders. */
  folder?: string;
  /** The conversation it was learned or last changed in; none for the user's own edit. */
  from?: LearnedIn;
};

export type LearnedIn = { conversation: string; folder: string; title: string };

/** The most points the reflector keeps per entry point, each one's section bounded on its own. */
export const MAX_PER_ENTRY_POINT = 10;

/** The most characters one point holds. */
export const MAX_REFLECTION_CHARS = 400;

/** The most characters a point's `when` holds. */
export const MAX_WHEN_CHARS = 200;

/** The most characters of a point's `evidence` kept. */
export const MAX_EVIDENCE_CHARS = 300;

export type ReflectorRequest =
  /** Every point, for Settings. */
  | { id: number; type: "reflections_list" }
  | { id: number; type: "reflections_remove"; reflection: string }
  | { id: number; type: "reflections_edit"; reflection: string; text: string };

export type ReflectorResponses = {
  reflections_list: Reflection[];
  reflections_remove: Reflection[];
  reflections_edit: Reflection[];
};
