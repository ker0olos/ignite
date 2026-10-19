// Windows paths may use either separator.
const lastSep = (path: string) =>
  Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));

export const basename = (path: string) => path.split(/[\\/]/).pop() || path;

export const dirname = (path: string) => path.slice(0, lastSep(path)) || "/";

export const tildify = (path: string, home: string) =>
  home &&
  (path === home || [home + "/", home + "\\"].some((h) => path.startsWith(h)))
    ? "~" + path.slice(home.length)
    : path;

const byName = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/** Folders sorted by name (then full path), so their order doesn't follow use. */
export const sortedByName = (paths: string[]) =>
  [...paths].sort(
    (a, b) => byName.compare(basename(a), basename(b)) || byName.compare(a, b),
  );

/** `path` relative to `root` when inside it (or it), else as given. */
export const relativeTo = (path: string, root: string) =>
  path === root || path.startsWith(`${root}/`)
    ? path.slice(root.length + 1)
    : path;
