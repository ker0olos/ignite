import type {
  AgentMessage,
  AssistantMessage,
  ToolCall,
  ToolResultMessage,
} from "../shared/agentTypes.ts";
import type { Session } from "./hostTypes.ts";
import { blockOnce, replayOnce } from "./resumeReplay.ts";
import {
  forgetWaiting,
  readWaiting,
  type Wait,
  type Waiting,
} from "./waitingCalls.ts";

export const INTERRUPTED =
  "Interrupted: the app closed while this ran. It may have partly run; check its effects before calling it again.";
export const UNASKED_OUTSIDE =
  "The sandbox blocked this command, and the app closed while asking the user to run it outside the sandbox. Call it again to ask again.";
const FINISHED = "Finished before the app closed (only its text is kept):\n";
const RESUME =
  "The app closed and reopened, cutting off your last run. Continue from where you stopped. Calls marked interrupted may have partly run; calls that were waiting for the user ask them again.";

type CutOff = { message?: AssistantMessage; calls: ToolCall[] };

/** A run the sidecar's end cut off: its last assistant message and the calls it left without results; null if none. */
export function cutOff(messages: AgentMessage[]): CutOff | null {
  let at = messages.length - 1;
  const settled = new Set<string>();
  for (; messages[at]?.role === "toolResult"; at--) {
    settled.add((messages[at] as ToolResultMessage).toolCallId);
  }
  const last = messages[at];
  if (last?.role === "user") return { calls: [] };
  const message = callsTools(last);
  if (!message) return settled.size ? { calls: [] } : null;
  const calls = message.content.filter(
    (c): c is ToolCall => c.type === "toolCall" && !settled.has(c.id),
  );
  return calls.length ? { message, calls } : { calls: [] };
}

const callsTools = (m: AgentMessage | undefined) =>
  m?.role === "assistant" && (m as AssistantMessage).stopReason === "toolUse"
    ? (m as AssistantMessage)
    : undefined;

/** What reopening a cut-off run does: results to record, and the message to run again with the calls to block. */
export type Plan = {
  results: ToolResultMessage[];
  replay?: AssistantMessage;
  blocked: Map<string, string>;
};

const resultOf = (call: ToolCall, text: string): ToolResultMessage => ({
  role: "toolResult",
  toolCallId: call.id,
  toolName: call.name,
  content: [{ type: "text", text }],
  isError: true,
  timestamp: Date.now(),
});

const textOf = (result: ToolResultMessage) =>
  result.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("\n");

const ended = (wait?: Wait) => (wait === "ran" ? UNASKED_OUTSIDE : INTERRUPTED);
const reasks = (wait?: Wait) => wait === "before" || wait === "asking";

/** How to resume. A call that waited before running means none had run (pi runs them once all are cleared), so all run again; else only the waiting ones. */
export function plan(messages: AgentMessage[], waiting: Waiting): Plan | null {
  const cut = cutOff(messages);
  if (!cut) return null;
  const { message, calls } = cut;
  const asking = calls.filter((c) => reasks(waiting[c.id]));
  if (!message || !asking.length) {
    const results = calls.map((c) => resultOf(c, ended(waiting[c.id])));
    return { results, blocked: new Map() };
  }
  const blocked = new Map<string, string>();
  const results = messages.slice(messages.indexOf(message) + 1);
  // ponytail: a finished call comes back as an error with its text only; images and details are lost.
  for (const r of results as ToolResultMessage[]) {
    blocked.set(r.toolCallId, FINISHED + textOf(r));
  }
  if (!asking.some((c) => waiting[c.id] === "before")) {
    for (const c of calls) {
      if (!asking.includes(c)) blocked.set(c.id, ended(waiting[c.id]));
    }
  }
  return { results: [], replay: message, blocked };
}

/** Moves the session back to before its last assistant message, so its run starts over from there. */
function rewind(s: Session) {
  const entry = s.sessionManager
    .getBranch()
    .findLast((e) => e.type === "message" && e.message?.role === "assistant");
  if (!entry) return false;
  if (entry.parentId === null) s.sessionManager.resetLeaf();
  else s.sessionManager.branch(entry.parentId);
  s.refreshContext();
  return true;
}

function record(s: Session, results: ToolResultMessage[]) {
  for (const result of results) s.sessionManager.appendMessage(result);
  if (results.length) s.refreshContext();
}

/** Resuming a cut-off run: `begin` runs it, `cancel` (before it begins) leaves its calls ended so a message the user sent goes first. */
export type Resume = {
  begin(): Promise<void>;
  /** False once begun; `asked` is the result of calls that waited on the user. */
  cancel(asked: string): Promise<boolean>;
  /** Settles once the run has started, or ended without starting. */
  started: Promise<void>;
};

const note = (s: Session) =>
  // A prompt follows, not triggerTurn: that skips before_agent_start
  // (pi#5581), so claude-bridge can't match the system prompt.
  s.sendCustomMessage(
    { customType: "ignite-resume", content: RESUME, display: false },
    { deliverAs: "nextTurn" },
  );

/** Readies a cut-off run, synchronously so the conversation the app is sent reads as it will run; null if none. */
export function prepareResume(s: Session): Resume | null {
  if (s.isStreaming) return null;
  const session = s.sessionManager.getSessionId();
  const waiting = readWaiting(session);
  const p = plan(s.messages, waiting);
  forgetWaiting(session);
  if (!p) return null;
  const leaf = s.sessionManager.getLeafId();
  if (p.replay && !rewind(s)) return null;
  record(s, p.results);

  let state: "ready" | "begun" | "cancelled" = "ready";
  let settle = () => {};
  const started = new Promise<void>((resolve) => (settle = resolve));
  // Puts the replayed message back, its waiting calls ended.
  const undo = (asked: string) => {
    if (!p.replay || leaf === null) return;
    s.sessionManager.branch(leaf);
    s.refreshContext();
    const calls = cutOff(s.messages)?.calls ?? [];
    const text = (c: ToolCall) =>
      reasks(waiting[c.id]) ? asked : ended(waiting[c.id]);
    record(
      s,
      calls.map((c) => resultOf(c, text(c))),
    );
  };

  return {
    started,
    async cancel(asked) {
      if (state !== "ready") return state === "cancelled";
      state = "cancelled";
      undo(asked);
      settle();
      await note(s);
      return true;
    },
    async begin() {
      if (state !== "ready") return;
      state = "begun";
      const restore = p.replay ? replayOnce(s, p.replay, RESUME) : undefined;
      const unblock = p.blocked.size ? blockOnce(s, p.blocked) : undefined;
      let running = false;
      const off = s.subscribe((e) => {
        if (e.type !== "agent_start") return;
        running = true;
        settle();
      });
      try {
        await note(s);
        await s.prompt("Continue", {});
      } catch (error) {
        if (!running) undo(INTERRUPTED);
        throw error;
      } finally {
        off();
        settle();
        restore?.();
        unblock?.();
      }
    },
  };
}
