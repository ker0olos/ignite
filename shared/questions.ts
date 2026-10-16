/** ask_user: questions the agent asks the user, and their answers. */
import type { ImageContent } from "./agentTypes.ts";

/** The tool the agent asks the user questions with; it waits like an approval. */
export const ASK_TOOL = "ask_user";

/** One of ask_user's questions, as the model writes it. */
export type Question = {
  question: string;
  /** A short label, e.g. "Storage". */
  header?: string;
  options: { label: string; description?: string }[];
  multiSelect?: boolean;
};

/** The user's reply to one question: picked labels (or their own text when none), a note beside picks, images. */
export type QuestionAnswer = {
  question: string;
  choices: string[];
  note?: string;
  images?: ImageContent[];
};

/** An answer as ask_user's result details keep it: its images counted, not stored twice. */
export type AnsweredQuestion = Omit<QuestionAnswer, "images"> & {
  images?: number;
};

/** ask_user's result details; none when the user left the questions to the agent. */
export type AskDetails = { answers: AnsweredQuestion[] };
