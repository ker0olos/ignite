/** Whether a conversation's agent stopped too soon, judged by the cheapest model of its provider. */
import {
  serializeConversation,
  type EventBus,
} from "@earendil-works/pi-coding-agent";
import type { AgentMessage, ImageContent } from "../shared/agentTypes.ts";
import type { Session } from "./hostTypes.ts";
import { cheapest } from "./router.ts";
import { STOP_EVENT, type StopAsk } from "./stopNudge.ts";

export type Verdict = "done" | "continue" | "ask";

const TIMEOUT_MS = 20_000;
const REQUEST_CHARS = 4_000;
const END_CHARS = 8_000;
// The agent's last reply and the work just before it.
const END_MESSAGES = 6;

const JUDGE_PROMPT = `You read a user's latest request to a coding agent and the end of the agent's work on it, at the moment the agent stopped and handed control back to the user. Judge what should happen next. Reply with exactly one word, nothing else:
- continue: the agent stopped partway through work the user asked for and could carry on by itself. Its reply says what it will do next ("Next I'm going through…", "Now I'll…"), lists steps it still means to do, asks leave to start or go on with work the user already asked for ("Say go and I'll start", "Shall I continue?"), or offers a step that finishes it: testing or verifying it, fixing the rest of the same problem, or delivering it ("Want me to push and open a PR?": pushes and pull requests wait for the user's review anyway; "Let me know if you want the other two fixed").
- ask: the reply ends with a real decision only the user can make ("Which approach do you prefer?") or offers new work beyond what was asked ("I could also add dark mode").
- done: anything else: the work is finished and reported, the user only asked a question and it's answered, the agent waits on something only the user can do (attach a device, sign in, provide a file), or it waits for work that reports back on its own (a fork, a background command).
When unsure, reply done.`;

type Llm = Parameters<typeof serializeConversation>[0];

/** The user's latest request and the end of the run, as the judge reads them. */
export function judgeInput(messages: readonly AgentMessage[]): string {
  const llm = messages.filter((m) =>
    ["user", "assistant", "toolResult"].includes(m.role),
  ) as Llm;
  const asked = llm.findLastIndex((m) => m.role === "user");
  const end = llm.slice(Math.max(asked + 1, llm.length - END_MESSAGES));
  const request =
    asked < 0
      ? ""
      : serializeConversation([llm[asked]]).slice(0, REQUEST_CHARS);
  return `${request}\n\n${serializeConversation(end).slice(-END_CHARS)}`.trim();
}

/** Judges session `s`'s runs as its extensions ask on `bus`. */
export function answerStops(bus: EventBus, s: Session) {
  bus.on(STOP_EVENT, (data) => {
    const ask = data as StopAsk;
    ask.reply(judgeStop(s, ask.signal));
  });
}

/** The verdict on `s`'s run that just ended; null when it can't judge. */
export function judgeStop(
  s: Pick<Session, "model" | "modelRuntime" | "messages">,
  signal?: AbortSignal,
): Promise<Verdict | null> {
  const words = ["continue", "ask", "done"] as const;
  return oneWord(s, JUDGE_PROMPT, judgeInput(s.messages), words, { signal });
}

/** The cheapest model of `s`'s provider answering `text` (and `images`, if it reads them) with one of `words`; null when it can't. */
export async function oneWord<W extends string>(
  s: Pick<Session, "model" | "modelRuntime">,
  systemPrompt: string,
  text: string,
  words: readonly W[],
  { signal, images = [] }: { signal?: AbortSignal; images?: ImageContent[] },
): Promise<W | null> {
  const found = await cheapest(s).catch(() => null);
  if (!found) return null;
  const seen = found.model.input.includes("image") ? images : [];
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const answer = await s.modelRuntime
    .completeSimple(
      found.model,
      {
        systemPrompt,
        messages: [
          {
            role: "user",
            content: seen.length ? [{ type: "text", text }, ...seen] : text,
            timestamp: Date.now(),
          },
        ],
      },
      // "none" keeps claude-bridge from sending it through the conversation's own session.
      {
        cacheRetention: "none",
        signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      },
    )
    .catch(() => null);
  if (!answer || answer.stopReason !== "stop") return null;
  const reply = answer.content
    .flatMap((c) => (c.type === "text" ? [c.text] : []))
    .join("")
    .replace(/^\W+|\W+$/g, "")
    .toLowerCase();
  return words.find((w) => w === reply) ?? null;
}
