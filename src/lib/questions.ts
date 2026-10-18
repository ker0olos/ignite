import type {
  AssistantMessage,
  ImageContent,
  ToolCall,
} from "../../shared/agentTypes";
import {
  ASK_TOOL,
  type AnsweredQuestion,
  type Question,
  type QuestionAnswer,
} from "../../shared/questions";
import { withFiles, type SentFile } from "../../shared/attachedFiles";
import { withComments, type SentComment } from "../../shared/sentComments";
import type { Item } from "./transcript";
import { isMac } from "./window";

/** One question's answer so far: picked labels, and the composer's text, images and dropped files (a note beside picks, else the answer). */
export type Draft = {
  picked: string[];
  text: string;
  images: ImageContent[];
  /** Missing in drafts saved before files could be attached. */
  files?: SentFile[];
};

export const EMPTY_DRAFT: Draft = {
  picked: [],
  text: "",
  images: [],
  files: [],
};

/** ask_user's questions from the call's arguments, skipping malformed ones. */
export function readQuestions(args: Record<string, unknown>): Question[] {
  if (!Array.isArray(args.questions)) return [];
  return args.questions.filter(
    (q): q is Question =>
      typeof q?.question === "string" && Array.isArray(q.options),
  );
}

/** Picks or unpicks an option; one question picks only one. */
export function toggle(draft: Draft, label: string, multi: boolean): Draft {
  const on = draft.picked.includes(label);
  if (!multi) return { ...draft, picked: on ? [] : [label] };
  const picked = on
    ? draft.picked.filter((l) => l !== label)
    : [...draft.picked, label];
  return { ...draft, picked };
}

/** The replies sent to the agent; a question with nothing picked, typed or attached is left to it. */
export function toAnswers(
  questions: Question[],
  drafts: Draft[],
): QuestionAnswer[] {
  return questions.map(({ question }, i) => {
    const { picked, text, images, files = [] } = drafts[i] ?? EMPTY_DRAFT;
    const typed = text.trim();
    const choices = picked.length ? picked : typed ? [typed] : [];
    // Files go in the note, like a message carries them; typed text is the note only beside picks.
    const note = withFiles(picked.length > 0 ? typed : "", files);
    return {
      question,
      choices,
      ...(note && { note }),
      ...(images.length > 0 && { images }),
    };
  });
}

/** What an answer says first: the choices, else what it was answered with, else that it was left to the agent. */
export function answerLabel(choices: string[], images = 0, files = 0) {
  if (choices.length) return choices.join(", ");
  if (files) return "Answered with files";
  return images ? "Answered with images" : "Left to the agent";
}

/** `answers` with the diff comments added to the last one's note, so they go with the answer like they would with a message. */
export function withAnswerComments(
  answers: QuestionAnswer[],
  comments: SentComment[],
): QuestionAnswer[] {
  if (!comments.length || !answers.length) return answers;
  const last = answers.at(-1)!;
  const note = withComments(last.note ?? "", comments);
  return [...answers.slice(0, -1), { ...last, note }];
}

/** What the composer's text is while a question shows: a note on the picks, or (undefined) the user's own answer. */
export function noteLabel(picked: string[]): string | undefined {
  if (picked.length === 0) return undefined;
  if (picked.length === 1) return `Note on ${picked[0]}`;
  return `Note on your ${picked.length} picks`;
}

/** The first waiting call when it's an ask_user call: its questions take over the composer. */
export function askingCall(
  items: Item[],
  waiting: string[],
): ToolCall | undefined {
  const first = waiting[0];
  if (!first) return undefined;
  for (const item of items) {
    if (item.kind !== "message" || item.message.role !== "assistant") continue;
    const call = (item.message as AssistantMessage).content.find(
      (b): b is ToolCall => b.type === "toolCall" && b.id === first,
    );
    if (call) return call.name === ASK_TOOL ? call : undefined;
  }
  return undefined;
}

/** The answers an ask_user result's details keep; undefined for older results and questions left to the agent. */
export function readAnswered(details: unknown): AnsweredQuestion[] | undefined {
  const answers = (details as { answers?: unknown } | undefined)?.answers;
  return Array.isArray(answers) ? (answers as AnsweredQuestion[]) : undefined;
}

/** The key shown on option `i` while option `focused` has focus: Space picks it, ↑/↓ reach its neighbours. */
export function optionHint(i: number, focused: number | null) {
  if (focused === null) return undefined;
  return ["↑", "Space", "↓"][i - focused + 1];
}

/** The option ⌥1…⌥9 (Alt off macOS) picks, by index; null for other keys. Read from `code`, since ⌥ changes the character on macOS. */
export function pickKey(e: {
  code: string;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}): number | null {
  if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return null;
  const digit = /^Digit([1-9])$/.exec(e.code);
  return digit ? Number(digit[1]) - 1 : null;
}

/** The hint for the key that picks option `i`. */
export function pickHint(i: number, mac = isMac()) {
  return `${mac ? "⌥" : "Alt+"}${i + 1}`;
}

/** Whether a key press types a character (Space picks, so it doesn't count). */
export function typesText(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}) {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  return e.key.length === 1 && e.key !== " ";
}
