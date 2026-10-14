const KEY = "file-tree-open";
const MAX = 500;

function load(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(saved)
      ? saved.filter((s) => typeof s === "string")
      : [];
  } catch {
    return [];
  }
}

let open: Set<string> | null = null;

/** Whether the file tree last showed this folder open (every window and folder, across launches). */
export function isFolderOpen(path: string) {
  open ??= new Set(load());
  return open.has(path);
}

/** Remembers a file tree folder opened or closed, keeping the newest 500 open ones. */
export function setFolderOpen(path: string, isOpen: boolean) {
  open ??= new Set(load());
  open.delete(path);
  if (isOpen) open.add(path);
  try {
    localStorage.setItem(KEY, JSON.stringify([...open].slice(-MAX)));
  } catch {
    // A convenience; without storage folders open closed next time.
  }
}
