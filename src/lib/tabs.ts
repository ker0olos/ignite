/** Open file tabs: an ordered list of paths plus the active one. */
export type Tabs = { files: string[]; active: string | null };

/** Opens `path` (appending it if new) and makes it active. */
export function openTab({ files }: Tabs, path: string): Tabs {
  return {
    files: files.includes(path) ? files : [...files, path],
    active: path,
  };
}

/**
 * Closes `path`. If it was active, the tab now at its position becomes active
 * (the one to its right, or the new last tab), or none when all are closed.
 */
export function closeTab({ files, active }: Tabs, path: string): Tabs {
  const index = files.indexOf(path);
  if (index === -1) return { files, active };
  const rest = files.filter((f) => f !== path);
  if (active !== path) return { files: rest, active };
  return {
    files: rest,
    active: rest[Math.min(index, rest.length - 1)] ?? null,
  };
}
