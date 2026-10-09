/**
 * Forks: a conversation copied, with its worktree's files, into a new one that
 * works separately while the original waits; closing it sends the original a
 * summary, and the original carries on.
 */
import {
  SessionManager,
  serializeConversation,
} from "@earendil-works/pi-coding-agent";
import { rmSync } from "node:fs";
import type { AgentMessage } from "../shared/agentTypes.ts";
import { APP_NAME } from "../src/lib/app.ts";
import type { Session } from "./hostTypes.ts";
import { cheapest } from "./router.ts";

// In the fork: what it was forked from. Its work up to a REPORTED entry was sent.
const FORKED = "ignite-fork";
const REPORTED = "ignite-fork-report";

const TIMEOUT_MS = 60_000;
// The newest part of a long run is what the original needs most.
const REPORT_CHARS = 60_000;

const REPORT_PROMPT = `You summarize a coding agent's latest work for another agent: the conversation it was forked from, which shares its context up to the fork but not what follows. Write a short report (at most 250 words) of what it did and found: results and numbers, decisions, files changed, problems left open. Plain prose, no preamble.`;

type Entry = {
  type: string;
  customType?: string;
  details?: { parent?: string };
  message?: AgentMessage;
};

// On globalThis: the host and each session's extensions load their own copy.
// ponytail: notes wait in memory, so a sidecar restart drops undelivered ones; persist them if that bites.
const shared = globalThis as { [key: symbol]: Map<string, string[]> };
const notes = (shared[Symbol.for(`${APP_NAME}.forkNotes`)] ??= new Map());

/** Adds a note for conversation `id`, delivered with its next run. */
export function noteFor(id: string, text: string) {
  notes.set(id, [...(notes.get(id) ?? []), text]);
}

/** The notes waiting for conversation `id`, taken. */
export function takeNotes(id: string): string[] {
  const waiting = notes.get(id) ?? [];
  notes.delete(id);
  return waiting;
}

/**
 * Copies `folder`'s saved conversation `from` into a new one, `to`, named
 * `name` and told it's a fork; throws when `from` has nothing saved yet.
 */
export function forkSession(
  folder: string,
  from: string,
  to: string,
  name: string,
) {
  const source = SessionManager.findById(folder, from);
  if (!source) throw new Error("There's nothing to fork yet.");
  const dir = SessionManager.create(folder).getSessionDir();
  const fork = SessionManager.forkFrom(source, folder, dir, { id: to });
  fork.appendSessionInfo(name);
  fork.appendCustomMessageEntry(
    FORKED,
    `You are a fork of conversation ${from}: the user copied it, with its files as they were, into this new conversation to work on something separately. The original waits for you; once the user closes you, a summary of what you did is sent to it and it carries on.`,
    false,
    { parent: from },
  );
}

/** Deletes fork `to`'s saved file, after the fork failed to start. */
export function dropFork(folder: string, to: string) {
  const file = SessionManager.findById(folder, to);
  if (file) rmSync(file, { force: true });
}

/** The conversation `s` was forked from, if it's a fork. */
export function forkOf(s: Pick<Session["sessionManager"], "getBranch">) {
  const branch = s.getBranch() as Entry[];
  return branch.findLast((e) => e.customType === FORKED)?.details?.parent;
}

/**
 * What a fork did since its last report, for the conversation it came from;
 * null when `s` isn't a fork or did nothing new. Marks it reported.
 */
export function unreported(s: {
  sessionManager: Pick<
    Session["sessionManager"],
    "getBranch" | "appendCustomEntry"
  >;
}) {
  const branch = s.sessionManager.getBranch() as Entry[];
  const parent = forkOf(s.sessionManager);
  if (!parent) return null;
  const since = branch.findLastIndex(
    (e) => e.customType === FORKED || e.customType === REPORTED,
  );
  const messages = branch
    .slice(since + 1)
    .flatMap((e) => (e.type === "message" && e.message ? [e.message] : []));
  if (!messages.some((m) => m.role === "assistant")) return null;
  s.sessionManager.appendCustomEntry(REPORTED);
  return { parent, messages };
}

const lastText = (messages: AgentMessage[]) => {
  const last = messages.findLast((m) => m.role === "assistant");
  const content = last && "content" in last ? last.content : [];
  return (Array.isArray(content) ? content : [])
    .flatMap((c) => (c.type === "text" ? [c.text] : []))
    .join("\n");
};

/** A summary of `messages` by the cheapest model of `s`'s provider; the last reply when none can write one. */
export async function summarize(
  s: Pick<Session, "model" | "modelRuntime"> | null | undefined,
  messages: AgentMessage[],
): Promise<string> {
  const found = s && (await cheapest(s).catch(() => null));
  if (!s || !found) return lastText(messages);
  const llm = messages.filter((m) =>
    ["user", "assistant", "toolResult"].includes(m.role),
  ) as Parameters<typeof serializeConversation>[0];
  const answer = await s.modelRuntime
    .completeSimple(
      found.model,
      {
        systemPrompt: REPORT_PROMPT,
        messages: [
          {
            role: "user",
            content: serializeConversation(llm).slice(-REPORT_CHARS),
            timestamp: Date.now(),
          },
        ],
      },
      // "none" keeps claude-bridge from sending it through the fork's own session.
      { cacheRetention: "none", signal: AbortSignal.timeout(TIMEOUT_MS) },
    )
    .catch(() => null);
  if (!answer) return lastText(messages);
  const text = answer.content
    .flatMap((c) => (c.type === "text" ? [c.text] : []))
    .join("");
  return answer.stopReason === "error" || !text ? lastText(messages) : text;
}
