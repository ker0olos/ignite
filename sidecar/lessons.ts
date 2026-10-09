import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { mcpCall } from "../src/lib/mcpToolCall.ts";

/** A mistake the agent wrote down so it doesn't make it again. */
export type Lesson = {
  id: string;
  text: string;
  /** tool_call: shown when the agent calls `tool`; system_prompt: in every run's system prompt. */
  level: "tool_call" | "system_prompt";
  /** The exact tool name (`git`, `bash`, `mcp__github`) or MCP tool name (`create_issue`). */
  tool?: string;
  /** Text in the call's arguments that marks it as the mistake; such a call is always blocked. */
  match?: string;
  /** The folder it applies to; none for every folder. */
  folder?: string;
  hits: number;
  lastHit?: number;
};

type NewLesson = Pick<Lesson, "text" | "level" | "tool" | "match" | "folder">;

export const MAX_LESSONS = 30;
const MIN_MATCH = 3;

const cache = new Map<string, { mtime: number; lessons: Lesson[] }>();

function parse(file: string): Lesson[] {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? (parsed as Lesson[]) : [];
  } catch {
    return [];
  }
}

/** Every saved lesson, read again only when the file changed; none when it's missing or unreadable. */
export function readLessons(file: string): Lesson[] {
  let mtime: number;
  try {
    mtime = statSync(file).mtimeMs;
  } catch {
    return [];
  }
  const cached = cache.get(file);
  if (cached?.mtime === mtime) return cached.lessons;
  const lessons = parse(file);
  cache.set(file, { mtime, lessons });
  return lessons;
}

// ponytail: last write wins across sidecars (one per window); a lock if lessons get lost.
function writeLessons(file: string, lessons: Lesson[]) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(lessons, null, 2)}\n`);
  renameSync(tmp, file);
  cache.set(file, { mtime: statSync(file).mtimeMs, lessons });
}

/** The lessons that apply in `folder`. */
export const lessonsFor = (lessons: Lesson[], folder: string) =>
  lessons.filter((l) => !l.folder || l.folder === folder);

function cleaned({ text, level, tool, match, folder }: NewLesson): NewLesson {
  if (level === "system_prompt") return { text, level, folder };
  if (!tool) throw new Error("A tool_call lesson needs `tool`.");
  if (match !== undefined && match.trim().length < MIN_MATCH)
    throw new Error(`\`match\` needs at least ${MIN_MATCH} characters.`);
  return { text, level, tool, match, folder };
}

/** The lesson `id` among those that apply in `folder`, or throws. */
export function lessonIn(file: string, folder: string, id: string): Lesson {
  const lesson = lessonsFor(readLessons(file), folder).find((l) => l.id === id);
  if (!lesson) throw new Error(`No lesson ${id}.`);
  return lesson;
}

/** Saves a lesson in place of `replaces`, or throws when its scope is full. */
export function addLesson(
  file: string,
  input: NewLesson,
  replaces?: string,
): Lesson {
  const fields = cleaned(input);
  const rest = readLessons(file).filter((l) => l.id !== replaces);
  const scope = rest.filter((l) => l.folder === fields.folder);
  if (scope.length >= MAX_LESSONS) {
    throw new Error(
      `${MAX_LESSONS} lessons already apply here. Merge this into one of them with \`replaces\`:\n${list(scope)}`,
    );
  }
  const lesson: Lesson = { ...fields, id: randomUUID().slice(0, 8), hits: 0 };
  writeLessons(file, [...rest, lesson]);
  return lesson;
}

/** Removes a lesson. */
export function removeLesson(file: string, id: string) {
  writeLessons(
    file,
    readLessons(file).filter((l) => l.id !== id),
  );
}

/** Counts a lesson's block. */
export function recordHit(file: string, id: string, now = Date.now()) {
  const all = readLessons(file).map((l) =>
    l.id === id ? { ...l, hits: l.hits + 1, lastHit: now } : l,
  );
  writeLessons(file, all);
}

/** One line per lesson, with its id and trigger. */
export const list = (lessons: Lesson[]) =>
  lessons
    .map((l) => {
      const on = l.tool ? ` (${l.tool}${l.match ? `: "${l.match}"` : ""})` : "";
      return `- [${l.id}]${on} ${l.text}`;
    })
    .join("\n");

function toolsOf(name: string, input: Record<string, unknown>) {
  const mcp = mcpCall(name, input);
  return mcp?.kind === "call" ? [name, mcp.tool] : [name];
}

/** A call's argument values as text (`git push --force`); the agent's `reason` left out. */
export function callText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) return value.map(callText).join(" ");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => key !== "reason")
      .map(([, v]) => callText(v))
      .join(" ");
  }
  return "";
}

/**
 * The lesson a tool call runs into: one whose `match` its arguments contain,
 * else one with no `match` not yet in `reminded`.
 */
export function lessonFor(
  lessons: Lesson[],
  name: string,
  input: Record<string, unknown>,
  reminded: Set<string>,
): Lesson | undefined {
  const tools = toolsOf(name, input);
  const mine = lessons.filter(
    (l) => l.level === "tool_call" && l.tool && tools.includes(l.tool),
  );
  const text = callText(input);
  return (
    mine.find((l) => l.match && text.includes(l.match)) ??
    mine.find((l) => !l.match && !reminded.has(l.id))
  );
}
