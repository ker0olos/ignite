export const basename = (path: string) => path.split("/").pop() || path;

export const dirname = (path: string) =>
  path.slice(0, path.lastIndexOf("/")) || "/";

export const tildify = (path: string, home: string) =>
  home && (path === home || path.startsWith(home + "/"))
    ? "~" + path.slice(home.length)
    : path;
