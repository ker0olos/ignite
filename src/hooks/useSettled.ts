import { useEffect, useMemo, useState } from "react";
import type { CommandPick } from "@/lib/commandQuery";

/**
 * The result to preview: a file only once it stays highlighted a moment, so
 * typing or arrowing past files doesn't highlight each one.
 */
export function usePreviewPick(pick: CommandPick | null) {
  const file = useSettled(pick?.kind === "file" ? pick : null, 150);
  return pick?.kind === "file" ? file : pick;
}

/** `value` once it has stayed the same (as JSON) for `ms`; until then the one before. */
function useSettled<T>(value: T, ms: number): T {
  const key = JSON.stringify(value) ?? "null";
  const [settled, setSettled] = useState(key);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(key), ms);
    return () => clearTimeout(timer);
  }, [key, ms]);
  return useMemo(() => JSON.parse(settled) as T, [settled]);
}
