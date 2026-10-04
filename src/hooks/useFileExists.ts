import { exists } from "@tauri-apps/plugin-fs";
import { useEffect, useState } from "react";

// A missing path is asked again after this: the agent may write it soon, or
// its work may reach the folder from its worktree.
const MISSING_FOR_MS = 5000;

const found = new Set<string>();
const missingAt = new Map<string, number>();
const checking = new Map<string, Promise<boolean>>();

function check(path: string): Promise<boolean> {
  let pending = checking.get(path);
  if (!pending) {
    pending = exists(path)
      .catch(() => false)
      .then((yes) => {
        checking.delete(path);
        if (yes) found.add(path);
        else missingAt.set(path, Date.now());
        return yes;
      });
    checking.set(path, pending);
  }
  return pending;
}

const missingRecently = (path: string) =>
  Date.now() - (missingAt.get(path) ?? -Infinity) < MISSING_FOR_MS;

/**
 * Whether `path` exists; false until known, or for null. Known at once on
 * remounts (markdown remounts inline code on every streamed render).
 */
export function useFileExists(path: string | null): boolean {
  const [known, setKnown] = useState<string>();
  const now = !!path && (found.has(path) || known === path);
  useEffect(() => {
    if (!path || found.has(path) || missingRecently(path)) return;
    let live = true;
    void check(path).then((yes) => {
      if (live && yes) setKnown(path);
    });
    return () => {
      live = false;
    };
  }, [path]);
  return now;
}
