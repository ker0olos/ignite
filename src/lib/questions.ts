import type { Question, QuestionAnswer } from "../../shared/questions";

/** In `picked`, the user's own answer (the text in `other`). */
export const OTHER = "\u0000other";

/** What the user has chosen so far for one question; notes by option label. */
export type Draft = {
  picked: string[];
  other: string;
  notes: Record<string, string>;
};

export const EMPTY_DRAFT: Draft = { picked: [], other: "", notes: {} };

/** ask_user's questions from the call's arguments, skipping malformed ones. */
export function readQuestions(args: Record<string, unknown>): Question[] {
  if (!Array.isArray(args.questions)) return [];
  return args.questions.filter(
    (q): q is Question =>
      typeof q?.question === "string" && Array.isArray(q.options),
  );
}

/** Picks or unpicks an option (or OTHER); one question picks only one. */
export function toggle(draft: Draft, label: string, multi: boolean): Draft {
  const on = draft.picked.includes(label);
  if (!multi) return { ...draft, picked: on ? [] : [label] };
  const picked = on
    ? draft.picked.filter((l) => l !== label)
    : [...draft.picked, label];
  return { ...draft, picked };
}

/** Typing an answer of their own picks it (in place of an option, unless multi). */
export function typeOther(draft: Draft, other: string, multi: boolean): Draft {
  const picked = draft.picked.includes(OTHER)
    ? draft.picked
    : toggle(draft, OTHER, multi).picked;
  return { ...draft, other, picked };
}

/** Sets the note on an option. */
export function setNote(draft: Draft, label: string, note: string): Draft {
  return { ...draft, notes: { ...draft.notes, [label]: note } };
}

/** The replies sent to the agent; a question with nothing picked is left to it. */
export function toAnswers(
  questions: Question[],
  drafts: Draft[],
): QuestionAnswer[] {
  return questions.map(({ question }, i) => {
    const { picked, other, notes } = drafts[i] ?? EMPTY_DRAFT;
    const choices = picked.flatMap((label) => {
      const answer = label === OTHER ? other.trim() : label;
      const note = notes[label]?.trim();
      return answer ? [{ answer, ...(note && { note }) }] : [];
    });
    return { question, choices };
  });
}
