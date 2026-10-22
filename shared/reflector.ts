/** The reflector's points: how the user wants the agent to work, each read where it applies (used by both). */

/** Where a point is read: beside the guidance of the work it's about. */
export type EntryPoint =
  "always" | "asking" | "planning" | "delivering" | "delegating";

export const ENTRY_POINTS: Record<
  EntryPoint,
  { label: string; where: string }
> = {
  always: { label: "Every reply", where: "In the system prompt" },
  asking: { label: "Asking", where: "Beside ask_user's instructions" },
  planning: {
    label: "Planning",
    where: "Beside task_update's instructions",
  },
  delivering: {
    label: "Delivering",
    where: "Beside the git tool's instructions",
  },
  delegating: {
    label: "Delegating",
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
  /** The conversation it was learned or last changed in; none for the user's own edit. */
  from?: LearnedIn;
};

export type LearnedIn = { conversation: string; folder: string; title: string };

/** The most points the reflector keeps per entry point, each one's section bounded on its own. */
export const MAX_PER_ENTRY_POINT = 10;

/** The most characters one point holds. */
export const MAX_REFLECTION_CHARS = 400;

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
