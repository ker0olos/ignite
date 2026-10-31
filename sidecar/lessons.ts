import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { lessonTool, type Lesson } from "../shared/lessons.ts";
import { mcpCall } from "../src/lib/mcpToolCall.ts";
import { regexCount, regexFlaw, regexSpeed } from "./lessonRegex.ts";

export type { Lesson };

type NewLesson = Pick<
  Lesson,
  | "text"
  | "level"
  | "tool"
  | "match"
  | "regex"
  | "quadratic"
  | "background"
  | "folder"
>;

export const MAX_LESSONS = 30;
/** The shortest `match` a tool_call lesson takes. */
const MIN_MATCH = 3;

/** A new lesson's id. */
const lessonId = () => randomUUID().slice(0, 8);

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

// A regex is checked for speed here, on save, never as calls run.
function checkedRegex(match: string) {
  const flaw = regexFlaw(match);
  if (flaw) throw new Error(flaw);
  const speed = regexSpeed(match);
  if (typeof speed === "string") throw new Error(speed);
  return { regex: true, ...(speed.quadratic && { quadratic: true }) };
}

function cleaned(lesson: NewLesson): NewLesson {
  const { text, level, tool, match, regex, background, folder } = lesson;
  if (level === "system_prompt") return { text, level, folder };
  if (!tool) throw new Error("A tool_call lesson needs `tool`.");
  if (background !== undefined && tool !== "bash")
    throw new Error("Only a `bash` lesson takes `background`.");
  const call = {
    text,
    level,
    tool,
    ...(background !== undefined && { background }),
  };
  if (match === undefined) return { ...call, folder };
  if (match.trim().length < MIN_MATCH)
    throw new Error(`\`match\` needs at least ${MIN_MATCH} characters.`);
  const kind = regex ? checkedRegex(match) : {};
  return { ...call, match, ...kind, folder };
}

const count = (l: Lesson, text: string) => {
  if (!l.match) return 0;
  if (!l.regex) return text.split(l.match).length - 1;
  return regexCount(l.match, text, l.quadratic);
};

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
  const lesson: Lesson = { ...fields, id: lessonId(), hits: 0 };
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
      const match = l.regex ? `/${l.match}/` : `"${l.match}"`;
      const on = l.tool
        ? ` (${lessonTool(l)}${l.match ? `: ${match}` : ""})`
        : "";
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

type Edit = { oldText: string; newText: string };

const isEdit = (v: unknown): v is Edit =>
  !!v &&
  typeof (v as Edit).oldText === "string" &&
  typeof (v as Edit).newText === "string";

const editsIn = (input: Record<string, unknown>) =>
  [input, ...(Array.isArray(input.edits) ? input.edits : [])].filter(isEdit);

// An edit is held only for what it adds: removing forbidden text, or keeping it as context, isn't repeating the mistake.
function heldBy(l: Lesson, input: Record<string, unknown>, edits: Edit[]) {
  if (!edits.length) return count(l, callText(input)) > 0;
  const rest = { ...input, oldText: "", newText: "", edits: [] };
  return (
    count(l, callText(rest)) > 0 ||
    edits.some((e) => count(l, e.newText) > count(l, e.oldText))
  );
}

/** The lesson a tool call runs into: one whose `match` its arguments contain (or, a regex, match). */
export function lessonFor(
  lessons: Lesson[],
  name: string,
  input: Record<string, unknown>,
): Lesson | undefined {
  const tools = toolsOf(name, input);
  const background = !!input.background;
  const mine = lessons.filter(
    (l) =>
      l.level === "tool_call" &&
      l.tool &&
      tools.includes(l.tool) &&
      (l.background === undefined || l.background === background),
  );
  const edits = editsIn(input);
  return mine.find((l) => heldBy(l, input, edits));
}
