/**
 * Claude Code's idle compaction, for claude-bridge conversations: a long one left idle is summarized
 * by a fork of its Claude Code session (read from the prompt cache), and compacted with it once the cache expires.
 */
import type {
  Options,
  Query,
  SDKMessage,
  query,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  ExtensionAPI,
  ExtensionContext,
  SessionBeforeCompactEvent,
} from "@earendil-works/pi-coding-agent";
import { APP_NAME } from "../src/lib/app.ts";
import { log } from "./hostLog.ts";

// Claude Code's threshold. The subscription caches for an hour, and every request starts the hour again.
const MIN_TOKENS = 200_000;
const CACHE_MS = 60 * 60_000;
const FORK_MS = CACHE_MS - 5 * 60_000;
const TURNS_KEPT = 50;

const SUMMARY_PROMPT = `The conversation is everything before this message. This message is the app's, not the user's: never mention it, or checkpoints or summarizing, in what you write. Write a checkpoint of that conversation that another model will continue the work from, with nothing else: no tools, no preamble.

## Goal
## Constraints & Preferences
(every rule and preference the user stated, in their words)
## Progress
### Done
### In Progress
### Blocked
## Key Decisions
## Next Steps
## Critical Context
(exact file paths, function names, error messages, values)`;

/** How the bridge's queries are run, guarded. */
export type Ask = typeof query;

/** A conversation's latest bridge query, and when its latest request started (and so its cache's hour). */
type Turn = { options: Options; at: number };

// On globalThis: extensions, and with them the bridge, load afresh per session.
const shared = globalThis as { [key: symbol]: Map<string, Turn> };
const turns = (shared[Symbol.for(`${APP_NAME}.bridgeTurns`)] ??= new Map());

function keep(id: string, options: Options): Turn {
  const turn = { options, at: Date.now() };
  turns.delete(id);
  turns.set(id, turn);
  for (const old of turns.keys()) {
    if (turns.size <= TURNS_KEPT) break;
    turns.delete(old);
  }
  return turn;
}

const tapped = (q: Query, seen: (m: SDKMessage) => void) => ({
  async next() {
    const r = await q.next();
    if (!r.done) seen(r.value);
    return r;
  },
  return: () => q.return(),
  throw: (error: unknown) => q.throw(error),
});

/** `q` as the bridge reads it; a conversation's turn is kept under the Claude Code session its init names, for a fork. */
export function tapTurn(q: Query, options: Options | undefined): Query {
  // One-off summaries run unsaved; askClaude runs with Claude Code's own tools.
  if (!options || options.persistSession === false) return q;
  if (!Array.isArray(options.tools) || options.tools.length) return q;
  let turn: Turn | undefined;
  const seen = (m: SDKMessage) => {
    if (m.type === "system" && m.subtype === "init")
      turn = keep(m.session_id, options);
    else if (m.type === "stream_event" && m.event.type === "message_start")
      if (turn) turn.at = Date.now();
  };
  return new Proxy(q, {
    get(target, prop) {
      if (prop === Symbol.asyncIterator) return () => tapped(target, seen);
      const value: unknown = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

const usesTool = (m: SDKMessage) =>
  (m.type === "stream_event" &&
    m.event.type === "content_block_start" &&
    m.event.content_block.type === "tool_use") ||
  (m.type === "assistant" &&
    m.message.content.some((c) => c.type === "tool_use"));

/** The checkpoint a fork of the Claude Code session in `options` writes; null when it fails, is stopped or reaches for a tool. */
export async function forkSummary(
  ask: Ask,
  options: Options,
  signal: AbortSignal,
): Promise<string | null> {
  let q: Query | undefined;
  // The bridge's tools still hang off the fork; a call would land in a turn that ended.
  const stop = () => void q?.interrupt().catch(() => {});
  signal.addEventListener("abort", stop, { once: true });
  try {
    q = ask({
      prompt: SUMMARY_PROMPT,
      options: {
        ...options,
        forkSession: true,
        persistSession: false,
        maxTurns: 1,
      },
    });
    for await (const m of q) {
      if (signal.aborted || usesTool(m)) return (stop(), null);
      if (m.type === "result")
        return m.subtype === "success" ? m.result.trim() || null : null;
    }
    return null;
  } catch (error) {
    log(`idle compaction failed: ${error}`);
    return null;
  } finally {
    signal.removeEventListener("abort", stop);
  }
}

// pi's own compaction adds these (its helpers aren't exported); later compactions carry them on.
function withFiles(
  summary: string,
  { fileOps }: SessionBeforeCompactEvent["preparation"],
) {
  const modifiedFiles = [
    ...new Set([...fileOps.edited, ...fileOps.written]),
  ].sort();
  const readFiles = [...fileOps.read]
    .filter((f) => !modifiedFiles.includes(f))
    .sort();
  const tag = (name: string, files: string[]) =>
    files.length ? `\n\n<${name}>\n${files.join("\n")}\n</${name}>` : "";
  return {
    summary:
      summary +
      tag("read-files", readFiles) +
      tag("modified-files", modifiedFiles),
    details: { readFiles, modifiedFiles },
  };
}

function longTurn(
  ctx: ExtensionContext,
  claudeSession: (piSession: string) => string | undefined,
) {
  // Not a subagent's, which nobody comes back to.
  if (!ctx.sessionManager.getSessionFile()) return;
  if (ctx.model?.provider !== "claude-bridge") return;
  if ((ctx.getContextUsage()?.tokens ?? 0) < MIN_TOKENS) return;
  const id = claudeSession(ctx.sessionManager.getSessionId());
  return id ? turns.get(id) : undefined;
}

const later = (ms: number, fn: () => void) => {
  const timer = setTimeout(fn, ms);
  timer.unref();
  return timer;
};

/** Summarizes a long claude-bridge conversation left idle while its cache is warm, and compacts it with that once the cache expires. */
export function idleCompaction(
  pi: Pick<ExtensionAPI, "on">,
  ask: Ask,
  claudeSession: (piSession: string) => string | undefined,
) {
  let timer: NodeJS.Timeout | undefined;
  let fork: AbortController | undefined;
  let summary: string | undefined;
  let compacting = false;

  const reset = () => {
    clearTimeout(timer);
    fork?.abort();
    fork = summary = undefined;
    compacting = false;
  };

  const compactLater = (ctx: ExtensionContext, leaf: string | null) => {
    timer = later(CACHE_MS, () => {
      const moved = ctx.sessionManager.getLeafId() !== leaf;
      if (moved || !ctx.isIdle() || ctx.hasPendingMessages()) return reset();
      compacting = true;
      ctx.compact({ onComplete: reset, onError: reset });
    });
  };

  const summarize = async (ctx: ExtensionContext, options: Options) => {
    const leaf = ctx.sessionManager.getLeafId();
    const mine = (fork = new AbortController());
    const text = await forkSummary(ask, options, mine.signal);
    if (mine.signal.aborted) return;
    fork = undefined;
    if (!text || ctx.sessionManager.getLeafId() !== leaf) return;
    summary = text;
    compactLater(ctx, leaf);
  };

  pi.on("agent_start", reset);
  pi.on("session_shutdown", (_event, ctx) => {
    reset();
    const id = claudeSession(ctx.sessionManager.getSessionId());
    if (id) turns.delete(id);
  });
  pi.on("agent_settled", (_event, ctx) => {
    reset();
    const turn = longTurn(ctx, claudeSession);
    const wait = turn ? turn.at + FORK_MS - Date.now() : -1;
    if (turn && wait >= 0)
      timer = later(wait, () => void summarize(ctx, turn.options));
  });
  // Only its own: a /compact the user runs meanwhile is summarized as they asked.
  pi.on("session_before_compact", ({ preparation }) => {
    if (!compacting || !summary) return;
    return {
      compaction: {
        ...withFiles(summary, preparation),
        firstKeptEntryId: preparation.firstKeptEntryId,
        tokensBefore: preparation.tokensBefore,
      },
    };
  });
}
