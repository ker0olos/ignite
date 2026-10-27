/** Whether a message sent mid-run steers the run or waits for its end, judged by the cheapest model of its provider. */
import type { ImageContent } from "../shared/agentTypes.ts";
import type { QueueKind } from "../shared/queue.ts";
import type { Session } from "./hostTypes.ts";
import { judgeInput, oneWord } from "./stopJudge.ts";

const MESSAGE_CHARS = 4_000;

const JUDGE_PROMPT = `A user sent a new message to a coding agent while it was still working. You read the request the agent is working on, the latest of its work, and the new message. Judge when the agent should read it. Reply with exactly one word, nothing else:
- steer: the message is about the work in progress, so the agent should read it before its next step: a correction, a constraint, a change of approach, more detail, something to add to the same work, or a question about what it's doing.
- later: a separate request that can wait until the current work is done.
When unsure, reply later.`;

/** The kind `text`, sent mid-run in `s` with `images`, should wait as; null when it can't judge. */
export async function judgeQueued(
  s: Pick<Session, "model" | "modelRuntime" | "messages">,
  text: string,
  images?: ImageContent[],
  signal?: AbortSignal,
): Promise<QueueKind | null> {
  const input = `${judgeInput(s.messages)}\n\nNew message:\n${text.slice(0, MESSAGE_CHARS)}`;
  const word = await oneWord(s, JUDGE_PROMPT, input, ["steer", "later"], {
    signal,
    images,
    label: "queue judge",
  });
  return word && (word === "steer" ? "steer" : "followUp");
}
