/** ask_user: questions the agent asks the user, and their answers. */

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

/** The user's reply to one question: picked labels or their own text, each with a note. */
export type QuestionAnswer = {
  question: string;
  choices: { answer: string; note?: string }[];
};
