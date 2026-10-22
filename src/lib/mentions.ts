import type { FileHit } from "../../shared/conversations";
import { fuzzyScore } from "../../shared/fuzzy";
import type { SkillInfo } from "../../shared/skills";
import { commandArgs, type CommandArg } from "./commandArgs";

/** A `/command` or `/skill` (only at the start) or `@mention` being typed, from `start` to the caret. */
export type Mention = {
  trigger: "/" | "@";
  query: string;
  start: number;
  end: number;
};

/** One completion: what replaces the typed token, and how its row reads. */
export type MentionOption = {
  kind: "command" | "skill" | "image" | "terminal" | "file" | "choice";
  insert: string;
  detail?: string;
  args?: CommandArg[];
};

const LIMIT = 8;

// The app's own `/` commands, which skills of the same name don't replace.
const COMMANDS: SkillInfo[] = [
  {
    name: "compact",
    description:
      "Summarize earlier messages to free up context; text after it steers the summary",
    argumentHint: "[instructions]",
    argumentDescriptions: ["What the summary should keep or focus on"],
  },
  {
    name: "fork",
    description:
      "Copy this conversation and its files into a new one that reports back here; text after it is its first message",
    argumentHint: "[first message]",
    argumentDescriptions: ["What the fork works on first"],
  },
];

/** `skills` but those the app's commands shadow. */
const unshadowed = (skills: SkillInfo[]) =>
  skills.filter((s) => !COMMANDS.some((c) => c.name === s.name));

/** The app's `/` commands, then the skills they don't shadow. */
export function slashCommands(skills: SkillInfo[]) {
  return [...COMMANDS, ...unshadowed(skills)];
}

/** The token at the caret if it's a mention, else null. */
export function mentionAt(text: string, caret: number): Mention | null {
  const m = /(^|\s)([/@])(\S*)$/.exec(text.slice(0, caret));
  if (!m) return null;
  const start = m.index + m[1].length;
  const trigger = m[2] as Mention["trigger"];
  if (trigger === "/" && start !== 0) return null;
  return { trigger, query: m[3], start, end: caret };
}

/** `items` matching `query` best first, at most LIMIT. */
function ranked<T>(query: string, items: T[], name: (item: T) => string) {
  return items
    .map((item) => [item, fuzzyScore(query, name(item))] as const)
    .filter(([, score]) => score !== null)
    .sort((a, b) => b[1]! - a[1]!)
    .slice(0, LIMIT)
    .map(([item]) => item);
}

/** Completions for `mention`: commands, then skills for `/`; images, attached files, terminals, then project files for `@`. */
export function mentionOptions(
  mention: Mention,
  found: {
    skills: SkillInfo[];
    images: number;
    /** What each attached image is shown as: its file's name, or "Clipboard". */
    imageNames?: string[];
    /** The names of the files attached to the message. */
    attached?: string[];
    terminals: string[];
    files: FileHit[];
  },
): MentionOption[] {
  const { query } = mention;
  if (mention.trigger === "/") {
    const named = (kind: "command" | "skill") => (s: SkillInfo) => {
      const args = commandArgs(s);
      return {
        kind,
        insert: `/${s.name}`,
        detail: s.description,
        ...(args.length > 0 && { args }),
      };
    };
    const skills = unshadowed(found.skills);
    return [
      ...ranked(query, COMMANDS, (c) => c.name).map(named("command")),
      ...ranked(query, skills, (s) => s.name).map(named("skill")),
    ].slice(0, LIMIT);
  }
  const images = Array.from(
    { length: found.images },
    (_, i) => `image${i + 1}`,
  );
  return [
    ...ranked(
      query,
      images.map((tag, i) => ({ tag, name: found.imageNames?.[i] })),
      (i) => i.tag,
    ).map(({ tag, name }) => ({
      kind: "image" as const,
      insert: `@${tag}`,
      ...(name && { detail: name }),
    })),
    ...ranked(
      query,
      (found.attached ?? []).map((name, i) => ({ tag: `file${i + 1}`, name })),
      (f) => f.tag,
    ).map((f) => ({
      kind: "file" as const,
      insert: `@${f.tag}`,
      detail: f.name,
    })),
    ...ranked(query, found.terminals, (t) => t).map((t) => ({
      kind: "terminal" as const,
      insert: `@${t}`,
      detail: "Terminal",
    })),
    ...found.files.map((f) => ({
      kind: "file" as const,
      insert: `@${f.path}`,
    })),
  ].slice(0, LIMIT);
}

/** `text` with `mention` replaced by `insert` and a space; the caret goes after it. */
export function insertMention(
  text: string,
  mention: { start: number; end: number },
  insert: string,
) {
  const before = `${text.slice(0, mention.start)}${insert} `;
  return {
    text: before + text.slice(mention.end).replace(/^ /, ""),
    caret: before.length,
  };
}

/** `text` with `@imageN` tags for `count` pasted images (numbered from `first`) in place of `start`–`end`. */
export function insertImageTags(
  text: string,
  start: number,
  end: number,
  first: number,
  count: number,
) {
  const tags = Array.from({ length: count }, (_, i) => `@image${first + i}`);
  const lead = start > 0 && !/\s/.test(text[start - 1]) ? " " : "";
  return insertMention(text, { start, end }, lead + tags.join(" "));
}

/** `/name …` as pi's skill command when `name` is one of `skills` and not one of the app's commands. */
export function skillPrompt(text: string, skills: SkillInfo[]) {
  const name = /^\/(\S+)/.exec(text)?.[1];
  const skill = unshadowed(skills).some((s) => s.name === name);
  return skill ? `/skill:${text.slice(1)}` : text;
}

/** The text after the app's `/name` command ("" for none), or null when `text` isn't that command. */
export function appCommand(
  name: "compact" | "fork",
  text: string,
): string | null {
  const m = new RegExp(`^/${name}(?:\\s+([\\s\\S]*))?$`).exec(text.trim());
  return m ? (m[1] ?? "").trim() : null;
}
