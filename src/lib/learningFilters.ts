import { lessonScope } from "@/lib/lessons";
import {
  ENTRY_POINTS,
  type EntryPoint,
  type Reflection,
} from "../../shared/reflector";
import type { Lesson } from "../../shared/lessons";
import type { Procedure } from "../../shared/procedures";

/** One filter chip: `id` null is All. */
export type Chip = { id: string | null; label: string; count: number };

const scopeId = (folder: string | undefined) =>
  folder === undefined ? "every" : `${FOLDER}${folder}`;

function tally(entries: { id: string; label: string }[]): Chip[] {
  const found = new Map<string, Chip>();
  for (const { id, label } of entries) {
    const chip = found.get(id) ?? { id, label, count: 0 };
    chip.count++;
    found.set(id, chip);
  }
  return [
    { id: null, label: "All", count: entries.length },
    ...distinct([...found.values()]).sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label),
    ),
  ];
}

const FOLDER = "folder:";

// Two folders of one name would give two chips that read the same, so each of those names its parent too.
function distinct(chips: Chip[]): Chip[] {
  const named = new Map<string, number>();
  for (const c of chips) named.set(c.label, (named.get(c.label) ?? 0) + 1);
  return chips.map((c) =>
    c.id?.startsWith(FOLDER) && named.get(c.label)! > 1
      ? {
          ...c,
          label: c.id.slice(FOLDER.length).split(/[\\/]/).slice(-2).join("/"),
        }
      : c,
  );
}

/** The chip a pick means: a pick whose chip is gone counts as All. */
export const activeFilter = (chips: Chip[], filter: string | null) =>
  chips.some((c) => c.id === filter) ? filter : null;

const matches = (query: string, ...fields: (string | undefined)[]) => {
  const q = query.trim().toLowerCase();
  return !q || fields.some((f) => f?.toLowerCase().includes(q));
};

const folderEntry = (folder: string | undefined) => ({
  id: scopeId(folder),
  label: lessonScope(folder),
});

/** Chips by the folder a lesson is kept for; one for every folder shows under All only, as a chip beside All would read as All. */
export function lessonChips(lessons: Lesson[]): Chip[] {
  const [all, ...folders] = tally(lessons.map((l) => folderEntry(l.folder)));
  return [all, ...folders.filter((c) => c.id !== scopeId(undefined))];
}

/** The lessons whose text, tool or match has `query` and whose scope is `filter`. */
export const filterLessons = (
  lessons: Lesson[],
  query: string,
  filter: string | null,
) => {
  const active = activeFilter(lessonChips(lessons), filter);
  return lessons.filter(
    (l) =>
      (active === null || scopeId(l.folder) === active) &&
      matches(query, l.text, l.tool, l.match),
  );
};

/** Chips by procedure folder. */
export const procedureChips = (procedures: Procedure[]) =>
  tally(procedures.map((p) => folderEntry(p.folder)));

/** The procedures whose title, steps or folder name has `query` and whose folder is `filter`. */
export const filterProcedures = (
  procedures: Procedure[],
  query: string,
  filter: string | null,
) => {
  const active = activeFilter(procedureChips(procedures), filter);
  return procedures.filter(
    (p) =>
      (active === null || scopeId(p.folder) === active) &&
      matches(query, p.title, ...p.steps, lessonScope(p.folder)),
  );
};

/** Chips by entry point, only those with points, in the entry points' order. */
export function reflectionChips(reflections: Reflection[]): Chip[] {
  const [all, ...rest] = tally(
    reflections.map((r) => ({
      id: r.entry,
      label: ENTRY_POINTS[r.entry].label,
    })),
  );
  const order = Object.keys(ENTRY_POINTS);
  return [
    all,
    ...rest.sort((a, b) => order.indexOf(a.id!) - order.indexOf(b.id!)),
  ];
}

/** The points whose text, when or evidence has `query` and whose entry point is `filter`. */
export const filterReflections = (
  reflections: Reflection[],
  query: string,
  filter: string | null,
) => {
  const active = activeFilter(reflectionChips(reflections), filter);
  return reflections.filter(
    (r) =>
      (active === null || r.entry === (active as EntryPoint)) &&
      matches(query, r.text, r.when, r.evidence),
  );
};
