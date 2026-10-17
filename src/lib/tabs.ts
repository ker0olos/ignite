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
