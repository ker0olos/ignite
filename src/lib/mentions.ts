import type { FileHit } from "../../shared/conversations";
import { fuzzyScore } from "../../shared/fuzzy";
import type { SkillInfo } from "../../shared/skills";

/** A `/skill` (only at the start) or `@mention` being typed, from `start` to the caret. */
export type Mention = {
  trigger: "/" | "@";
  query: string;
  start: number;
  end: number;
};

/** One completion: what replaces the typed token, and how its row reads. */
export type MentionOption = {
  kind: "skill" | "image" | "terminal" | "file";
  insert: string;
  detail?: string;
};

const LIMIT = 8;

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

/** Completions for `mention`: skills for `/`; images, terminals, then files for `@`. */
export function mentionOptions(
  mention: Mention,
  found: {
    skills: SkillInfo[];
    images: number;
    terminals: string[];
    files: FileHit[];
  },
): MentionOption[] {
  const { query } = mention;
  if (mention.trigger === "/") {
    return ranked(query, found.skills, (s) => s.name).map((s) => ({
      kind: "skill",
      insert: `/${s.name}`,
      detail: s.description,
    }));
  }
  const images = Array.from(
    { length: found.images },
    (_, i) => `image${i + 1}`,
  );
  return [
    ...ranked(query, images, (i) => i).map((i) => ({
      kind: "image" as const,
      insert: `@${i}`,
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
export function insertMention(text: string, mention: Mention, insert: string) {
  const before = `${text.slice(0, mention.start)}${insert} `;
  return {
    text: before + text.slice(mention.end).replace(/^ /, ""),
    caret: before.length,
  };
}

/** `/name …` as pi's skill command when `name` is one of `skills`. */
export function skillPrompt(text: string, skills: SkillInfo[]) {
  const name = /^\/(\S+)/.exec(text)?.[1];
  return skills.some((s) => s.name === name) ? `/skill:${text.slice(1)}` : text;
}
