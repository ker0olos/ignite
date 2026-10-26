/** The agent's memory across conversations, as the app and the sidecar exchange it. */

/** What an observation records; cmem's "code" mode kinds, so its memories import as they are. */
export const OBSERVATION_TYPES = [
  "bugfix",
  "feature",
  "refactor",
  "change",
  "discovery",
  "decision",
  "security_alert",
  "security_note",
  "sensitive",
] as const;

/** What kind of knowledge an observation holds. */
export const CONCEPTS = [
  "how-it-works",
  "why-it-exists",
  "what-changed",
  "problem-solution",
  "gotcha",
  "pattern",
  "trade-off",
] as const;

/** The concept of an observation that records how a run got past an error, offered to the folder's next conversations on a matching task. */
export const PROCEDURE = "procedure";

/** A run's summary, kept beside its observations. */
export const SUMMARY_TYPE = "summary";

/** Something remembered, as Settings lists it. */
export type MemoryObservation = {
  id: number;
  /** One of OBSERVATION_TYPES, or SUMMARY_TYPE. */
  type: string;
  title: string;
  subtitle?: string;
  /** Milliseconds since the epoch. */
  createdAt: number;
  /** The agent that did the work: "claude", "codex", this app's name… */
  platform: string;
  /** Standalone statements of what it found or did. */
  facts: string[];
  /** The files it read or changed, from the folder's root. */
  files: string[];
};

/** The memory for the open folder, if any. */
export type MemoryStatus = {
  /** How many of each type it keeps, summaries left out. */
  counts: Record<string, number>;
  /** Its latest, newest first, or the best matches for a search; of one type when asked. */
  observations: MemoryObservation[];
};
