/** Whether a conversation's agent stopped too soon, judged by the cheapest model of its provider. */
import {
  serializeConversation,
  type EventBus,
} from "@earendil-works/pi-coding-agent";
import type { AgentMessage, ImageContent } from "../shared/agentTypes.ts";
import type { Session } from "./hostTypes.ts";
import { askModel, cheapest } from "./cheapCall.ts";
import { STOP_EVENT, type StopAsk } from "./stopNudge.ts";

export type Verdict = "done" | "continue" | "ask" | "lesson";

const TIMEOUT_MS = 20_000;
const REQUEST_CHARS = 4_000;
// Messages sent mid-run can ask something in passing while an earlier one's work waits ("before you start X, do Y").
const REQUESTS = 3;
const END_CHARS = 8_000;
// The agent's last reply and the work just before it.
const END_MESSAGES = 6;

// Offered only when its nudge can go out: a "lesson" dropped later would lose the continue or ask the run needed.
const LESSON_RULE = `- lesson: a user message in the run corrects a mistake the agent made and could make again (a wrong command, tool, fact or step, or work that didn't work: "you need to use my real browser", "that's the wrong file"). Not a wish about how the agent works or reports (shorter replies, ask less), and not the user changing what they want. This comes before every other word.\n`;

const JUDGE_RULES = `- continue: the agent stopped partway through work the user asked for and could carry on by itself. Work an earlier message asked for that the agent hasn't done or started counts ("before you start X, do Y" leaves X to do once Y is done), unless a later message dropped it. Its reply says what it will do next ("Next I'm going through…", "Now I'll…"), lists steps it still means to do, asks leave to start or go on with work the user already asked for ("Say go and I'll start", "Shall I continue?"), or offers a step that finishes it: testing or verifying it, fixing the rest of the same problem, or delivering it ("Want me to push and open a PR?": pushes and pull requests wait for the user's review anyway; "Let me know if you want the other two fixed").
- ask: the reply ends with a real decision only the user can make ("Which approach do you prefer?") or offers new work beyond what was asked ("I could also add dark mode").
- done: anything else: the work is finished and reported, the user only asked a question and it's answered, the agent waits on something only the user can do (attach a device, sign in, approve, check something themselves, provide a file), or it waits for work that reports back on its own (a fork, a background command). Waiting on the user is done even when the reply lists the steps it will take after that.
When unsure, reply done.`;

const judgePrompt = (lessons: boolean) =>
  `You read the user's messages to a coding agent during its last run (oldest first) and the end of the agent's work, at the moment the agent stopped and handed control back to the user. Judge what should happen next. Reply with exactly one word, nothing else:\n${lessons ? LESSON_RULE : ""}${JUDGE_RULES}`;

type Llm = Parameters<typeof serializeConversation>[0];

// The run that just ended starts after the reply that ended the one before it.
const runStart = (llm: Llm) =>
  llm
    .slice(0, -1)
    .findLastIndex(
      (m) =>
        m.role === "assistant" &&
        (m as { stopReason?: string }).stopReason !== "toolUse",
    ) + 1;

/** The user's messages in the run that just ended (or their latest), and its end, as the judge reads them. */
export function judgeInput(messages: readonly AgentMessage[]): string {
  const llm = messages.filter((m) =>
    ["user", "assistant", "toolResult"].includes(m.role),
  ) as Llm;
  const users = llm.flatMap((m, i) => (m.role === "user" ? [i] : []));
  const inRun = users.filter((i) => i >= runStart(llm));
  const asked = inRun.length ? inRun : users.slice(-1);
  const last = users.at(-1) ?? -1;
  const end = llm.slice(Math.max(last + 1, llm.length - END_MESSAGES));
  // Each from its start, where the ask is, before what's pasted after it.
  const request = asked
    .slice(-REQUESTS)
    .map((i) => serializeConversation([llm[i]!]).slice(0, REQUEST_CHARS))
    .join("\n\n");
  return `${request}\n\n${serializeConversation(end).slice(-END_CHARS)}`.trim();
}

/** Judges session `s`'s runs as its extensions ask on `bus`. */
export function answerStops(bus: EventBus, s: Session) {
  bus.on(STOP_EVENT, (data) => {
    const ask = data as StopAsk;
    ask.reply(judgeStop(s, ask.signal, ask.lessons));
  });
}

/** The verdict on `s`'s run that just ended; null when it can't judge. */
export function judgeStop(
  s: Pick<Session, "model" | "modelRuntime" | "messages">,
  signal?: AbortSignal,
  lessons = false,
): Promise<Verdict | null> {
  const words: Verdict[] = ["continue", "ask", "done"];
  if (lessons) words.push("lesson");
  return oneWord(s, judgePrompt(lessons), judgeInput(s.messages), words, {
    signal,
    label: "stop judge",
  });
}

/** The cheapest model of `s`'s provider answering `text` (and `images`, if it reads them) with one of `words`; null when it can't. */
export async function oneWord<W extends string>(
  s: Pick<Session, "model" | "modelRuntime">,
  systemPrompt: string,
  text: string,
  words: readonly W[],
  {
    signal,
    images = [],
    label,
  }: { signal?: AbortSignal; images?: ImageContent[]; label: string },
): Promise<W | null> {
  const found = await cheapest(s).catch(() => null);
  if (!found) return null;
  const seen = found.model.input.includes("image") ? images : [];
  const reply = await askModel(
    s,
    found.model,
    systemPrompt,
    seen.length ? [{ type: "text", text }, ...seen] : text,
    { label, timeoutMs: TIMEOUT_MS, signal },
  );
  const word = reply?.replace(/^\W+|\W+$/g, "").toLowerCase();
  return words.find((w) => w === word) ?? null;
}
