/** skills.json: which of the app's skills are off, and which are always on. */
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import type { Skill } from "@earendil-works/pi-coding-agent";

type State = { disabled: string[]; always: string[] };

const ids = (value: unknown) =>
  Array.isArray(value) ? value.filter((d) => typeof d === "string") : [];

/** Whether `id` or a folder holding it is in `list`. */
export const isUnder = (id: string, list: string[]) =>
  list.some((d) => id === d || id.startsWith(`${d}/`));

/** Reads and edits skills.json at `path`; a missing or unreadable one lists nothing. */
export function skillState(path: string) {
  const read = (): State => {
    try {
      const { disabled, always } = JSON.parse(readFileSync(path, "utf8"));
      return { disabled: ids(disabled), always: ids(always) };
    } catch {
      return { disabled: [], always: [] };
    }
  };
  const write = (state: State) =>
    writeFile(path, JSON.stringify(state, null, 2) + "\n");
  return {
    read,
    /** Adds or drops `id` in one of the lists. */
    mark(list: keyof State, id: string, on: boolean) {
      const state = read();
      const rest = state[list].filter((d) => d !== id);
      return write({ ...state, [list]: on ? [...rest, id] : rest });
    },
    /** Drops `id` and everything under it from both lists. */
    forget(id: string) {
      const { disabled, always } = read();
      const kept = (d: string) => !isUnder(d, [id]);
      return write({
        disabled: disabled.filter(kept),
        always: always.filter(kept),
      });
    },
  };
}

/** An always-on skill's whole text, without its frontmatter, for the prompt. */
export const alwaysText = (skill: Skill) =>
  `## Skill: ${skill.name} (always on)\nFollow it on every task. Its files are in ${skill.baseDir}.\n\n${readFileSync(
    skill.filePath,
    "utf8",
  )
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
    .trim()}`;
