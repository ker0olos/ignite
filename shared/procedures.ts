/** Procedures as Settings lists them: how a run got past a failed command (sidecar/procedures.ts). */
import type { LearnedIn } from "./reflector.ts";

export type Procedure = {
  id: number;
  /** When it applies, e.g. "Running the sidecar's tests". */
  title: string;
  steps: string[];
  folder: string;
  /** When it was recorded (ms). */
  at: number;
  /** The conversation it was learned in, when it's known. */
  from?: LearnedIn;
};

export type ProcedureRequest =
  /** Every folder's procedures, newest first, for Settings. */
  | { id: number; type: "procedures_list" }
  | { id: number; type: "procedures_remove"; procedure: number };

export type ProcedureResponses = {
  procedures_list: Procedure[];
  procedures_remove: Procedure[];
};
