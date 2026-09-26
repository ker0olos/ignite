/** Moves `path` to the front of the recent-folders list, without duplicates. */
export function withRecent(folders: string[], path: string) {
  return [path, ...folders.filter((p) => p !== path)];
}

/** Keeps `current` only while it is still in the recent list. */
export function stillListed(current: string | null, folders: string[]) {
  return current && folders.includes(current) ? current : null;
}
