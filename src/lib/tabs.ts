/** Open file tabs: an ordered list of paths plus the active one. */
export type Tabs = { files: string[]; active: string | null };

/** Opens `path` (appending it if new) and makes it active. */
export function openTab({ files }: Tabs, path: string): Tabs {
  return {
    files: files.includes(path) ? files : [...files, path],
    active: path,
  };
}

/** What takes `closing`'s place: the one to its right, else the new last one, else none. */
export function neighbour(list: string[], closing: string): string | null {
  const i = list.indexOf(closing);
  const rest = list.filter((s) => s !== closing);
  return rest[i] ?? rest[i - 1] ?? rest.at(-1) ?? null;
}

/** Closes `path`; if it was active, its neighbour becomes active. */
export function closeTab({ files, active }: Tabs, path: string): Tabs {
  if (!files.includes(path)) return { files, active };
  const rest = files.filter((f) => f !== path);
  if (active !== path) return { files: rest, active };
  return { files: rest, active: neighbour(files, path) };
}

/** Where a tab shows: the editor pane beside the conversation, or under it. */
export type Dock = "side" | "bottom";

/** Each dock's tabs, and the dock the user last used (⌘W closes its tab). */
export type Docks = Record<Dock, Tabs> & { focus: Dock };

export const NO_DOCKS: Docks = {
  side: { files: [], active: null },
  bottom: { files: [], active: null },
  focus: "side",
};

const DOCKS: Dock[] = ["side", "bottom"];

/** The dock holding `path`, if it's open. */
export function dockOf(docks: Docks, path: string): Dock | null {
  return DOCKS.find((d) => docks[d].files.includes(path)) ?? null;
}

/** Opens `path` in the dock already holding it, else beside the conversation. */
export function openDocked(docks: Docks, path: string): Docks {
  const to = dockOf(docks, path) ?? "side";
  return { ...docks, [to]: openTab(docks[to], path), focus: to };
}

/** Closes `path`; focus leaves a dock it emptied. */
export function closeDocked(docks: Docks, path: string): Docks {
  const next = {
    side: closeTab(docks.side, path),
    bottom: closeTab(docks.bottom, path),
    focus: docks.focus,
  };
  if (next[next.focus].active) return next;
  return { ...next, focus: next.focus === "side" ? "bottom" : "side" };
}

/** Shows `path` in its dock and focuses that dock. */
export function activateDocked(docks: Docks, path: string): Docks {
  const to = dockOf(docks, path);
  if (!to) return docks;
  return { ...docks, [to]: { ...docks[to], active: path }, focus: to };
}

/** Moves open tab `path` to `index` of `to`'s tabs (counted with `path` still in place), showing it there. */
export function moveTab(
  docks: Docks,
  path: string,
  to: Dock,
  index: number,
): Docks {
  if (!dockOf(docks, path)) return docks;
  const from = docks[to].files.indexOf(path);
  const at = from !== -1 && from < index ? index - 1 : index;
  const left = {
    side: closeTab(docks.side, path),
    bottom: closeTab(docks.bottom, path),
  };
  const rest = left[to].files;
  const files = [...rest.slice(0, at), path, ...rest.slice(at)];
  return { ...left, [to]: { files, active: path }, focus: to };
}

/** Each conversation's tabs, by `tabsKey`. */
export type TabSets = Record<string, Docks>;

/**
 * The key a folder's conversation keeps its tabs under; `session` null before
 * its first message, undefined while the folder's conversation isn't known yet.
 */
export const tabsKey = (folder: string, session: string | null | undefined) =>
  `${folder}\n${session === undefined ? "?" : (session ?? "")}`;

const tabsOf = (d: Docks | undefined) =>
  d ? [...d.side.files, ...d.bottom.files] : [];

/** Every tab open in any conversation. */
export const everyTab = (sets: TabSets) => Object.values(sets).flatMap(tabsOf);

/** Closes `path` in every conversation. */
export function closeEverywhere(sets: TabSets, path: string): TabSets {
  return Object.fromEntries(
    Object.entries(sets).map(([k, d]) => [k, closeDocked(d, path)]),
  );
}

/** Drops a closed conversation's tabs, or (no `session`) every one of the folder's. */
export function forgetTabs(
  sets: TabSets,
  folder: string,
  session?: string,
): TabSets {
  const gone = (k: string) =>
    session === undefined
      ? k.startsWith(`${folder}\n`)
      : k === tabsKey(folder, session);
  return Object.fromEntries(Object.entries(sets).filter(([k]) => !gone(k)));
}

/** `extra`'s tabs added after `d`'s, none twice; `extra`'s shown ones stay shown. */
function mergeDocks(d: Docks, extra: Docks): Docks {
  const had = new Set(tabsOf(d));
  const join = (t: Tabs, more: Tabs): Tabs => {
    const files = [...t.files, ...more.files.filter((f) => !had.has(f))];
    const active =
      more.active && files.includes(more.active) ? more.active : t.active;
    return { files, active: active ?? files.at(-1) ?? null };
  };
  return {
    side: join(d.side, extra.side),
    bottom: join(d.bottom, extra.bottom),
    focus: extra.focus,
  };
}

/** Moves the tabs under key `from` to key `to`, after any `to` has. */
export function handTabs(sets: TabSets, from: string, to: string): TabSets {
  const moving = sets[from];
  if (!moving || from === to) return sets;
  const rest = Object.fromEntries(
    Object.entries(sets).filter(([k]) => k !== from),
  );
  const kept = rest[to];
  return { ...rest, [to]: kept ? mergeDocks(kept, moving) : moving };
}

/** Renames key `key`'s tabs by `names` (e.g. a folder's files to its worktree's copies). */
export function renameTabs(
  sets: TabSets,
  key: string,
  names: Record<string, string>,
): TabSets {
  const d = sets[key];
  if (!d) return sets;
  const rename = (p: string) => names[p] ?? p;
  const tabs = (t: Tabs): Tabs => ({
    files: t.files.map(rename),
    active: t.active && rename(t.active),
  });
  return {
    ...sets,
    [key]: { side: tabs(d.side), bottom: tabs(d.bottom), focus: d.focus },
  };
}

/** The tab ids under `key` (to rename them). */
export const tabsUnder = (sets: TabSets, key: string) => tabsOf(sets[key]);

/** The conversation (by id) whose tabs hold `tab`, if any has it; not one before its first message or still loading. */
export function tabOwner(sets: TabSets, tab: string): string | null {
  for (const [key, d] of Object.entries(sets)) {
    const session = key.slice(key.lastIndexOf("\n") + 1);
    if (session && session !== "?" && tabsOf(d).includes(tab)) return session;
  }
  return null;
}

/** Renames tabs in every conversation, e.g. a starting terminal's stand-in to the terminal. */
export const renameEverywhere = (
  sets: TabSets,
  names: Record<string, string>,
) => Object.keys(sets).reduce((all, key) => renameTabs(all, key, names), sets);
