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
