import type { ToolResult } from "./agentTypes.ts";

/** pi's tool that runs a script calling the other tools. */
export const CODEMODE_TOOL = "codemode";

/** One call a script made, with its result, as the script's result keeps it. */
export type ScriptCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /** Unset while it runs; "unfinished" when the script ended first. */
  status?: "done" | "error" | "unfinished";
  result?: ToolResult;
};

/** What the app adds to a script's result details: its calls, and how much they returned. */
export type ScriptDetails = {
  calls: ScriptCall[];
  /** Characters the calls returned to the script. */
  seen: number;
  durationMs?: number;
};

/** The rule a script's first line follows, so the user reads why it runs. */
export const SCRIPT_REASON_RULE =
  "Start the script with a `// <why>` comment line (after the @options line, if any): " +
  "why you're running it, in one plain sentence the user reads as the script's title.";

/** A script's reason: its first comment line (after an `// @options:` line), or "". */
export function scriptReason(code: unknown): string {
  if (typeof code !== "string") return "";
  const lines = code.trimStart().split("\n");
  const first = /^\s*\/\/\s*@options:/.test(lines[0] ?? "") ? 1 : 0;
  const match = /^\s*\/\/\s*(.*\S)\s*$/.exec(lines[first] ?? "");
  return match && !match[1].startsWith("@") ? match[1] : "";
}

/** A script's details, when `details` holds them. */
export function scriptDetails(details: unknown): ScriptDetails | undefined {
  const d = details as Partial<ScriptDetails> | undefined;
  return Array.isArray(d?.calls) ? (d as ScriptDetails) : undefined;
}
