/** After a run ends, as the host's judge (stopJudge.ts) says: sends the agent on, or has it ask with ask_user. */
import type {
  BeforeAgentStartEvent,
  ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { CODEMODE_TOOL } from "../shared/codemode.ts";
import { LESSON_ADD_TOOL } from "../shared/lessons.ts";
import { ASK_TOOL } from "../shared/questions.ts";
import { backgroundOf } from "./backgroundBash.ts";
import type { Verdict } from "./stopJudge.ts";

export const ASK_NUDGE = `Your reply ended with a question or an offer for the user. Ask it with ${ASK_TOOL} now, with concrete options, and carry on with their answer; when it's whether to commit, push or open a pull request, follow the git guidance instead. Don't repeat your reply.`;

export const CONTINUE_NUDGE = `You stopped partway through what the user asked, with nothing to wait on from them. Carry on with the next step now, without asking leave. Don't repeat your reply.`;

export const LESSON_NUDGE = `The user corrected a mistake of yours in this run. Save it now with ${LESSON_ADD_TOOL}: the mistake and what to do instead. Then, if your reply left the user a decision, ask it with ${ASK_TOOL}; otherwise carry on with what's left of the work, if anything. Don't repeat your reply.`;

/** pi event bus channel carrying a StopAsk to the host. */
export const STOP_EVENT = "app/stop-judge";

/** The conversation's run that just ended, for the host to judge; `reply` takes its verdict, `signal` is the user's Stop. */
export type StopAsk = {
  signal?: AbortSignal;
  /** Whether the judge may say "lesson": lessons are on and the run saved none. */
  lessons: boolean;
  reply(verdict: Promise<Verdict | null>): void;
};

// A few per user message, so a reply that keeps stopping can't loop.
const MAX_NUDGES = 3;

/** Whether a run ended with a reply that finished on its own (not a tool call, stop or error), with nothing it waits on. */
function endedOnItsOwn(messages: readonly unknown[], session: string) {
  const last = messages.at(-1) as { role?: string; stopReason?: string };
  if (last?.role !== "assistant" || last.stopReason !== "stop") return false;
  // It carries on once the commands it waits on exit.
  return !backgroundOf(session).some((b) => b.wake);
}

type Block = { type?: string; name?: string; arguments?: { code?: unknown } };

// A script's calls show only in its code.
const savesLesson = (c: Block) =>
  c.name === LESSON_ADD_TOOL ||
  (c.name === CODEMODE_TOOL &&
    String(c.arguments?.code).includes(LESSON_ADD_TOOL));

const callsLesson = (run: readonly unknown[]) =>
  run.some((m) => {
    const { content } = m as { content?: unknown };
    return (
      Array.isArray(content) &&
      (content as Block[]).some((c) => c.type === "toolCall" && savesLesson(c))
    );
  });

const NUDGES: Partial<Record<Verdict, string>> = {
  ask: ASK_NUDGE,
  continue: CONTINUE_NUDGE,
  lesson: LESSON_NUDGE,
};

const judged = (
  pi: ExtensionAPI,
  signal: AbortSignal | undefined,
  lessons: boolean,
) =>
  new Promise<Verdict | null>((resolve) => {
    let heard = false;
    pi.events.emit(STOP_EVENT, {
      signal,
      lessons,
      reply: (verdict) => {
        heard = true;
        verdict.then(resolve, () => resolve(null));
      },
    } satisfies StopAsk);
    if (!heard) resolve(null);
  });

/** Nudges the agent after runs that ended too soon; returns what before_agent_start calls, which resets the count on a user's message. */
export function nudgeStops(pi: ExtensionAPI) {
  let nudges = 0;
  pi.on("agent_end", async (event, ctx) => {
    if (nudges >= MAX_NUDGES || !pi.getActiveTools().includes(ASK_TOOL)) return;
    const session = ctx.sessionManager.getSessionId();
    if (!endedOnItsOwn(event.messages, session)) return;
    const lessons =
      pi.getActiveTools().includes(LESSON_ADD_TOOL) &&
      !callsLesson(event.messages);
    const verdict = await judged(pi, ctx.signal, lessons);
    const content = verdict && NUDGES[verdict];
    if (!content) return;
    // The user stopped it, or wrote something, while it was judged.
    if (ctx.signal?.aborted || ctx.hasPendingMessages()) return;
    nudges++;
    pi.sendMessage(
      { customType: "stop-nudge", content, display: false },
      { triggerTurn: true, deliverAs: "followUp" },
    );
  });
  return (event: BeforeAgentStartEvent) => {
    // A nudge starts its run as a custom message, not the user's.
    if (event.messageType === "user" && event.prompt.trim()) nudges = 0;
  };
}
