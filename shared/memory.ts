/** claude-mem (cmem) as the app and the sidecar exchange it. */

/** Something claude-mem recorded, as its worker lists it. */
export type MemoryObservation = {
  id: number;
  /** claude-mem's kind: "bugfix", "feature", "decision", "discovery"… */
  type: string;
  title: string;
  subtitle?: string;
  /** Milliseconds since the epoch. */
  createdAt: number;
  /** The tool that recorded it: "claude", "codex", this app's name… */
  platform: string;
};

/** claude-mem on this Mac, for the open folder if any. */
export type MemoryStatus = {
  state: "not-installed" | "stopped" | "excluded" | "running";
  /** The worker's web viewer, while it runs. */
  viewerUrl?: string;
  /** The open folder's latest observations, newest first. */
  observations: MemoryObservation[];
};

/** cmem's summary of a conversation's latest run. */
export type SessionSummary = {
  request?: string;
  completed?: string;
  learned?: string;
  nextSteps?: string;
};
