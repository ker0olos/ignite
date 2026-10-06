import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { SUBAGENT_TOOL } from "../shared/subagents.ts";
import { TASK_TOOL } from "../shared/tasks.ts";
import { blockedSummary } from "./sandbox.ts";
import { gitOr } from "./worktreeGit.ts";

/** Tools that change files, which wait until the task is planned. */
export const CHANGES_FILES = new Set(["edit", "write"]);

/** pi event bus channel asking whether the conversation's work is planned. */
const PLANNED_EVENT = "app/planned";

type PlannedAsk = { heard: boolean; reply(planned: boolean): void };

/** Whether the conversation may change files; true where nothing gates it (no task extension). */
export const isPlanned = (pi: Pick<ExtensionAPI, "events">) =>
  new Promise<boolean>((reply) => {
    const ask: PlannedAsk = { heard: false, reply };
    pi.events.emit(PLANNED_EVENT, ask);
    if (!ask.heard) reply(true);
  });

/** Answers isPlanned for this session with `planned()`. */
export const answerPlanned = (
  pi: Pick<ExtensionAPI, "events">,
  planned: () => Promise<boolean>,
) =>
  pi.events.on(PLANNED_EVENT, (data) => {
    const ask = data as PlannedAsk;
    ask.heard = true;
    void planned().then(ask.reply);
  });

// ponytail: an ignored folder that doesn't exist yet (a first `target/`) stays read-only until the plan.
/** What git ignores in `cwd` that exists (caches, builds), as absolute paths. */
async function ignoredPaths(cwd: string): Promise<string[]> {
  const listed = await gitOr(cwd, [
    "ls-files",
    "--others",
    "--ignored",
    "--exclude-standard",
    "--directory",
    "-z",
  ]);
  return (listed ?? "")
    .split("\0")
    .filter(Boolean)
    .map((path) => join(cwd, path.replace(/\/$/, "")));
}

/** Where bash may write in `cwd` while the work isn't planned: only what git ignores; undefined once planned. */
export async function writableUntilPlanned(
  pi: Pick<ExtensionAPI, "events">,
  cwd: string,
): Promise<string[] | undefined> {
  return (await isPlanned(pi)) ? undefined : ignoredPaths(cwd);
}

export const PLAN_FIRST = `Plan first: call ${TASK_TOOL} to lay out the subtasks, or to confirm the ones given, before changing files.`;

/** A sandboxed command that tried to write in the folder before the plan. */
export const READ_ONLY_UNTIL_PLANNED = `The folder is read-only until the work is planned. ${PLAN_FIRST}`;

/** A command outside the sandbox that changed files before the plan; its changes stand. */
export const CHANGED_UNPLANNED = `This command changed files before the work was planned. ${PLAN_FIRST}`;

export const SUBAGENT_PLAN_FIRST = `Plan first: call ${TASK_TOOL} before starting a subagent that can change files. An explore subagent can start now.`;

/** Why a tool call waits for the plan, or null: file changes, and new subagents that aren't explore ones. */
export function planFirst(toolName: string, input: Record<string, unknown>) {
  if (CHANGES_FILES.has(toolName)) return PLAN_FIRST;
  if (toolName !== SUBAGENT_TOOL || input.explore || input.id) return null;
  return SUBAGENT_PLAN_FIRST;
}

/**
 * A read-only run's result when the sandbox blocked a write in one of
 * `folders` (the folder as named and as resolved), or reported nothing yet;
 * null for anything else, which asks to run outside as usual.
 */
export function unplannedWrite(explained: string, folders: string[]) {
  const summary = blockedSummary(explained);
  const path = /^file-write\S* (.+)$/.exec(summary ?? "")?.[1];
  const inside = !!path && folders.some((f) => path.startsWith(f + "/"));
  if (summary && !inside) return null;
  const text = `${explained}\n\n${READ_ONLY_UNTIL_PLANNED}`;
  return { content: [{ type: "text" as const, text }] };
}
