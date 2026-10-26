import type { ToolResult } from "../../shared/agentTypes";
import { scriptDetails } from "../../shared/codemode";
import { resultText, type ToolBadge } from "./toolLabels";
import { plural } from "./toolRows";
import type { ToolRun } from "./transcript";

export type ScriptStatus = "running" | "waiting" | "done" | "failed";

/** Where a script stands; waiting while it runs and any of its calls waits for the user. */
export function scriptStatus(
  run: ToolRun | undefined,
  tools: Record<string, ToolRun>,
): ScriptStatus {
  if (!run || run.status === "running") {
    const waits = run?.nested?.some((c) => tools[c.id]?.approval);
    return waits ? "waiting" : "running";
  }
  return run.status === "error" ? "failed" : "done";
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

const EDITS = new Set(["edit", "write"]);

function failedSummary(
  run: ToolRun | undefined,
  tools: Record<string, ToolRun>,
) {
  const edits = (run?.nested ?? []).filter(
    (c) => EDITS.has(c.name) && tools[c.id]?.status === "done",
  ).length;
  if (!edits) return "Failed";
  const noun = edits === 1 ? "edit it made is" : "edits it made are";
  return `Failed · the ${edits} ${noun} kept`;
}

function doneSummary(calls: string, run: ToolRun | undefined) {
  const ms = run?.durationMs ?? scriptDetails(run?.result?.details)?.durationMs;
  return ms === undefined ? calls : `${calls} · ${seconds(ms)}`;
}

/** The script's status line: "8 calls · 1.8s", "Running · 3 calls so far", "Failed · the 2 edits it made are kept". */
export function scriptSummary(
  status: ScriptStatus,
  run: ToolRun | undefined,
  tools: Record<string, ToolRun>,
): string {
  const calls = plural(run?.nested?.length ?? 0, "call", "calls");
  const lines = {
    running: () => `Running · ${calls} so far`,
    waiting: () => `Waiting for you · ${calls} so far`,
    failed: () => failedSummary(run, tools),
    done: () => doneSummary(calls, run),
  };
  return lines[status]();
}

/** Tokens as "840", "1.2k", "84k". */
function tokens(chars: number) {
  const n = Math.round(chars / 4);
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(n / 1000)}k`;
}

// pi's first block, for the model; the script's row already shows its status and time.
const PI_HEADER = /^Script (?:completed|failed)\n/;

/** What the script printed (or its error), without pi's "Script completed / Wall time / Output:" block. */
export function scriptOutput(result: ToolResult | undefined) {
  const [first, ...rest] = result?.content ?? [];
  const headed = first?.type === "text" && PI_HEADER.test(first.text);
  const content = headed ? rest : (result?.content ?? []);
  return resultText({ ...result, content }).trimEnd();
}

/** The script's last step: Done once it finished, Failed when it failed with something to say, else none. */
export function scriptEnd(status: ScriptStatus, output: string) {
  if (status === "done") return "done";
  return status === "failed" && output ? "failed" : null;
}

/** The collapsed output's label: "Output · 12 lines". */
export const outputLabel = (text: string) =>
  `Output · ${plural(text.split("\n").length, "line", "lines")}`;

/** What the agent was sent of what the script's calls returned, or null unless the script cut it down. */
export function tokenFooter(output: string, run: ToolRun | undefined) {
  const seen = scriptDetails(run?.result?.details)?.seen ?? 0;
  const [sentText, seenText] = [tokens(output.length), tokens(seen)];
  if (output.length >= seen || sentText === seenText) return null;
  return `Sent the agent ${sentText} of ${seenText} tokens`;
}

const SCRIPT_BADGES: Record<ScriptStatus, ToolBadge> = {
  running: "running",
  waiting: "waiting",
  failed: "error",
  done: "ok",
};

/** The badge on a script's tile. */
export const scriptBadge = (status: ScriptStatus) => SCRIPT_BADGES[status];
