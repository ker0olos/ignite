import { useCallback, useState } from "react";

const KEY = "cleared-children";
// ponytail: oldest dropped past this; a conversation's rows come back only if it's that old.
const MAX = 200;

function load(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(saved)
      ? saved.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

/** Finished subagents and background commands the user cleared from the sidebar, by tab id; kept in this window's storage. */
export function useClearedChildren() {
  const [cleared, setCleared] = useState(load);
  const clear = useCallback((id: string) => {
    setCleared((before) => {
      const next = [...before.filter((c) => c !== id), id].slice(-MAX);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Cleared for now, if not after a reload.
      }
      return next;
    });
  }, []);
  return { cleared, clear };
}
