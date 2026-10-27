/**
 * A conversation's tool calls waiting on the user, on disk so a conversation
 * a reload or quit cut off asks them again when it reopens (hostResume.ts).
 */
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { log } from "./hostLog.ts";

/** When a call waits: before it runs (`tool_call`), asking inside the tool before it acts, or after a sandboxed run (to run outside). */
export type Wait = "before" | "asking" | "ran";

/** Call id → when it waits. */
export type Waiting = Record<string, Wait>;

const dir = () => join(getAgentDir(), "waiting");
const file = (session: string) => join(dir(), `${session}.json`);

/** Conversation `session`'s calls that were waiting on the user. */
export function readWaiting(session: string): Waiting {
  try {
    const saved: unknown = JSON.parse(readFileSync(file(session), "utf8"));
    return saved && typeof saved === "object" ? (saved as Waiting) : {};
  } catch {
    return {};
  }
}

function write(session: string, waiting: Waiting) {
  try {
    if (!Object.keys(waiting).length) return forgetWaiting(session);
    mkdirSync(dir(), { recursive: true });
    const temp = `${file(session)}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(waiting));
    renameSync(temp, file(session));
  } catch (error) {
    // Only a reopened conversation's prompts depend on it.
    log(`waiting calls not saved: ${error}`);
  }
}

/** Records that call `id` waits on the user. */
export function markWaiting(session: string, id: string, wait: Wait) {
  write(session, { ...readWaiting(session), [id]: wait });
}

/** Records that call `id` no longer waits. */
export function unmarkWaiting(session: string, id: string) {
  const waiting = readWaiting(session);
  if (!(id in waiting)) return;
  delete waiting[id];
  write(session, waiting);
}

/** Forgets every call conversation `session` had waiting. */
export function forgetWaiting(session: string) {
  rmSync(file(session), { force: true });
}
