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
