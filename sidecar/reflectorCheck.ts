/** A second read of each point the reflector added or changed: kept only when it says what the user's words say, about how the agent works. */
import type { Reflection } from "../shared/reflector.ts";
import type { Session } from "./hostTypes.ts";
import { oneWord } from "./stopJudge.ts";

const CHECK_PROMPT = `A coding agent keeps points on how its user wants it to work, each taught by the user's own words. You get one point, the words that taught it, and the user's whole message they come from. Reply with exactly one word, nothing else:
- faithful: every rule, case and step in the point is in the words, about how the agent should work.
- wider: the point goes past the words: a rule, case, method or step they don't state ("i need to see the fix" doesn't say which browser, or "never use a harness").
- against: the point says the opposite of the words, or would have the agent do what they complain about.
- task: the words are about this task (what to build, a choice between options, a fact about the project), not how the agent works.
When unsure, reply wider.`;

const VERDICTS = ["faithful", "wider", "against", "task"] as const;

const plain = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Whether `evidence` is the user's own words: found in their feedback, case and punctuation aside. */
export const groundedIn =
  (feedback: string[]) =>
  (evidence: string): boolean =>
    !!plain(evidence) && plain(feedback.join(" ")).includes(plain(evidence));

const statement = (p: Reflection) =>
  p.when ? `When ${p.when}: ${p.text}` : p.text;

// The feedback item holding the evidence, for the words around it; all of it when the words span two.
const sourceOf = (feedback: string[], evidence: string) =>
  feedback.find((f) => plain(f).includes(plain(evidence))) ??
  feedback.join("\n");

const faithful = async (
  s: Pick<Session, "model" | "modelRuntime">,
  p: Reflection,
  feedback: string[],
) => {
  // Only this run's words are checked: a point edited in Settings, or one keeping an earlier run's, stays as before.
  const words = p.evidence;
  if (!words || !groundedIn(feedback)(words)) return true;
  const text = `The point: ${statement(p)}\n\nThe words that taught it: "${words}"\n\nThe user's message: ${sourceOf(feedback, words)}`;
  const verdict = await oneWord(s, CHECK_PROMPT, text, VERDICTS, {
    label: "reflector check",
    unclear: "wider",
  });
  // A check that can't run keeps the point, as before it.
  return verdict === null || verdict === "faithful";
};

/** `next` with each added or changed point checked against its evidence: a new one that fails is dropped, a changed one goes back to what it was. */
export async function checked(
  s: Pick<Session, "model" | "modelRuntime">,
  next: Reflection[],
  points: Reflection[],
  feedback: string[],
): Promise<Reflection[]> {
  const verdicts = await Promise.all(
    next.map((p) => (points.includes(p) ? true : faithful(s, p, feedback))),
  );
  return next.flatMap((p, i) => {
    if (verdicts[i]) return [p];
    const was = points.find((q) => q.id === p.id);
    return was ? [was] : [];
  });
}
