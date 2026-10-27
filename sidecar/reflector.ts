/**
 * The reflector: after a run in which the user gave feedback (wrote back, answered a question with a note,
 * denied a call, rewound), the cheapest model of the conversation's provider reads it and rewrites the
 * points on how the user wants the agent to work (reflectorExtension.ts), so later conversations work their way.
 */
import { randomUUID } from "node:crypto";
import type { AgentMessage } from "../shared/agentTypes.ts";
import {
  ENTRY_POINTS,
  MAX_EVIDENCE_CHARS,
  MAX_REFLECTION_CHARS,
  MAX_PER_ENTRY_POINT,
  MAX_WHEN_CHARS,
  type LearnedIn,
  type Reflection,
  TAUGHT_BY,
} from "../shared/reflector.ts";
import type { Session } from "./hostTypes.ts";
import { runText } from "./memoryWriter.ts";
import { MAX_EDITS, REFLECT_PROMPT, UNCHANGED } from "./reflectorPrompt.ts";
import { cheapest } from "./router.ts";

const TIMEOUT_MS = 60_000;
// ponytail: a long conversation is read as its start and its end; excerpts around each feedback if the middle ever matters.
const CONVERSATION_CHARS = 100_000;
const OPENING_CHARS = 10_000;
// The conversation as the memory's writer reads it (private text left out), whole up to CONVERSATION_CHARS, else its opening and its end.
function conversationText(messages: AgentMessage[]) {
  const text = runText(messages, [], Infinity).join("\n\n");
  if (text.length <= CONVERSATION_CHARS) return text;
  const end = text.slice(-(CONVERSATION_CHARS - OPENING_CHARS));
  return `${text.slice(0, OPENING_CHARS)}\n\n[…]\n\n${end}`;
}

const listed = (p: Reflection) =>
  [
    `- [${p.id}] (${p.entry}) ${p.text}`,
    ...(p.when ? [` · when: ${p.when}`] : []),
    ...(p.evidence ? [` · taught by: "${p.evidence}"`] : []),
  ].join("");

/** The reflector's user message: the points, the feedback, the conversation. */
export function reflectorInput(
  feedback: string[],
  messages: AgentMessage[],
  points: Reflection[],
): string {
  return [
    `The points:\n${points.map(listed).join("\n") || "(none)"}`,
    `The user's feedback:\n${feedback.map((f) => `- ${f}`).join("\n")}`,
    `The conversation:\n${conversationText(messages)}`,
  ].join("\n\n");
}

type Raw = {
  id?: unknown;
  entry?: unknown;
  text?: unknown;
  taught?: unknown;
  drop?: unknown;
  when?: unknown;
  evidence?: unknown;
};

const TOO_LONG = Symbol("too long");

// As the prompt reads it after "When": one line, no "When" of its own, no closing colon.
const cleanWhen = (v: string) =>
  v
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^when\s+/i, "")
    .replace(/\s*[:.]$/, "");

// `when` as the reply wrote it ("" clears it), else the point's own; "too long" when it can't be kept.
function when(raw: Raw, was?: Reflection) {
  if (typeof raw.when !== "string") return was?.when;
  const t = cleanWhen(raw.when);
  return t.length > MAX_WHEN_CHARS ? TOO_LONG : t || undefined;
}

function evidence(raw: Raw, was?: Reflection) {
  if (typeof raw.evidence !== "string") return was?.evidence;
  return raw.evidence.trim().slice(0, MAX_EVIDENCE_CHARS) || undefined;
}

const known = <T extends string>(map: Record<T, unknown>, v: unknown) =>
  typeof v === "string" && v in map ? (v as T) : undefined;

const entryOf = (raw: Raw, was?: Reflection) =>
  raw.entry === undefined ? was?.entry : known(ENTRY_POINTS, raw.entry);

// A point's `when`; undefined for a new point whose own is too long, which without its situation would apply to all work.
function scopeOf(raw: Raw, was?: Reflection) {
  const scoped = when(raw, was);
  if (scoped !== TOO_LONG) return { when: scoped };
  return was ? { when: was.when } : undefined;
}

// A point's text and entry point as written, a changed one's own where left out; undefined when invalid.
function contentOf(raw: Raw, was?: Reflection) {
  const written = typeof raw.text === "string" ? raw.text.trim() : undefined;
  const text = written ?? was?.text ?? "";
  const entry = entryOf(raw, was);
  if (!text || text.length > MAX_REFLECTION_CHARS || !entry) return undefined;
  const scope = scopeOf(raw, was);
  if (!scope) return undefined;
  return { text, entry, ...scope, evidence: evidence(raw, was) };
}

// New evidence alone changes nothing the agent reads, so it's ignored and costs no edit.
const same = (
  was: Reflection,
  now: Pick<Reflection, "text" | "entry" | "when">,
) => was.text === now.text && was.entry === now.entry && was.when === now.when;

type Learned = Pick<Reflection, "at" | "from">;

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

type Grounded = (evidence: string) => boolean;

// Words given must be the user's; a new point must have some.
const theirs = (raw: Raw, grounded: Grounded, isNew: boolean, kept?: string) =>
  (typeof raw.evidence !== "string" || grounded(raw.evidence)) &&
  (!isNew || !!kept);

function pointOf(
  raw: Raw,
  points: Reflection[],
  learned: Learned,
  grounded: Grounded,
) {
  const was = points.find((p) => p.id === raw.id);
  const kept = [raw.text, raw.entry, raw.when].every((v) => v === undefined);
  if (was && kept) return was;
  const content = contentOf(raw, was);
  if (!content || !theirs(raw, grounded, !was, content.evidence))
    return undefined;
  if (!was) {
    const taught = known(TAUGHT_BY, raw.taught) ?? "reply";
    return { id: randomUUID().slice(0, 8), ...content, taught, ...learned };
  }
  if (same(was, content)) return was;
  const taught = known(TAUGHT_BY, raw.taught) ?? was.taught;
  return { ...was, ...content, taught, ...learned };
}

const isRaw = (r: unknown): r is Raw => !!r && typeof r === "object";

// One of the reply's points as it takes effect: a drop, the point, or nothing.
function applied(
  raw: Raw,
  was: Reflection | undefined,
  points: Reflection[],
  learned: Learned,
  spend: () => boolean,
  grounded: Grounded,
): Reflection | "drop" | undefined {
  if (raw.drop === true) return was && spend() ? "drop" : undefined;
  const point = pointOf(raw, points, learned, grounded);
  return point === was || !point || spend() ? point : was;
}

// The reply's points in its order, then those it left out; only an explicit
// drop removes one. Past the budget, a point stays as it was and none is added;
// a repeat of a point already handled costs nothing and does nothing.
function merged(
  list: Raw[],
  points: Reflection[],
  learned: Learned,
  grounded: Grounded,
) {
  let edits = 0;
  const spend = () => edits++ < MAX_EDITS;
  const done = new Set<string>();
  const dropped = new Set<string>();
  const named: Reflection[] = [];
  for (const raw of list) {
    const was = points.find((p) => p.id === raw.id);
    if (was && done.has(was.id)) continue;
    if (was) done.add(was.id);
    const result = applied(raw, was, points, learned, spend, grounded);
    if (result === "drop") dropped.add(was!.id);
    else if (result) named.push(result);
  }
  const left = points.filter(
    (p) => !dropped.has(p.id) && !named.some((q) => q.id === p.id),
  );
  return [...named, ...left];
}

// A full entry point takes a new or moved point only in place of a drop: points
// already there keep their places, so the cap never drops one unasked.
function capped(all: Reflection[], points: Reflection[]) {
  const stayed = (p: Reflection) =>
    points.some((q) => q.id === p.id && q.entry === p.entry);
  const first = [...all.filter(stayed), ...all.filter((p) => !stayed(p))];
  const fits = new Set(
    first
      .filter(
        (p, i) =>
          first.slice(0, i).filter((q) => q.entry === p.entry).length <
          MAX_PER_ENTRY_POINT,
      )
      .map((p) => p.id),
  );
  return all.filter((p) => fits.has(p.id));
}

/** The points from the reflector's reply, their evidence `grounded` in the user's feedback; undefined when it keeps them or the reply isn't valid. */
export function parsePoints(
  reply: string,
  points: Reflection[],
  learned: Learned = { at: Date.now() },
  grounded: Grounded = () => true,
): Reflection[] | undefined {
  if (reply.trim().startsWith(UNCHANGED)) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(
      reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1),
    );
  } catch {
    return undefined;
  }
  const list = (raw as { points?: unknown } | null)?.points;
  if (!Array.isArray(list)) return undefined;
  const next = capped(
    merged(list.filter(isRaw), points, learned, grounded),
    points,
  );
  const same =
    next.length === points.length && next.every((p, i) => p === points[i]);
  return same ? undefined : next;
}

/** The points rewritten from the feedback in conversation `from` by the cheapest model of `s`'s provider; undefined when unchanged or it can't run. */
export async function reflect(
  s: Pick<Session, "model" | "modelRuntime">,
  feedback: string[],
  messages: AgentMessage[],
  points: Reflection[],
  from?: LearnedIn,
): Promise<Reflection[] | undefined> {
  const found = await cheapest(s).catch(() => null);
  if (!found) return undefined;
  const content = reflectorInput(feedback, messages, points);
  const answer = await s.modelRuntime
    .completeSimple(
      found.model,
      {
        systemPrompt: REFLECT_PROMPT,
        messages: [{ role: "user", content, timestamp: Date.now() }],
      },
      // "none" keeps claude-bridge from sending it through the conversation's own session.
      { cacheRetention: "none", signal: AbortSignal.timeout(TIMEOUT_MS) },
    )
    .catch(() => null);
  if (!answer || answer.stopReason === "error") return undefined;
  return parsePoints(
    answer.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join(""),
    points,
    { at: Date.now(), from },
    groundedIn(feedback),
  );
}
