import { useEffect, useState } from "react";
import type { MemoryStatus } from "../../shared/memory";
import type { HostClient } from "@/lib/piHost";

const TYPING_MS = 200;

type Filter = { folder: string | null; query: string; kind: string | null };

/**
 * The open `folder`'s memories, fetched each time `watching` turns on (the
 * settings dialog opening), so they're fresh, and again as the search's
 * words (once typing pauses) or its type change.
 */
export function useMemory(
  host: HostClient | null,
  folder: string | null,
  watching: boolean,
) {
  const [status, setStatus] = useState<MemoryStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kept with the folder it was set in, so another folder starts unfiltered.
  const [filter, setFilter] = useState<Filter>({
    folder,
    query: "",
    kind: null,
  });
  const { query, kind } =
    filter.folder === folder ? filter : { query: "", kind: null };

  useEffect(() => {
    if (!host || !watching) return;
    let live = true;
    const timer = setTimeout(
      () =>
        host
          .request({
            type: "memory_status",
            ...(folder && { cwd: folder }),
            ...(query.trim() && { query }),
            ...(kind && { kind }),
          })
          .then((next) => {
            if (!live) return;
            setStatus(next);
            setError(null);
          })
          .catch((e: Error) => live && setError(e.message)),
      query.trim() ? TYPING_MS : 0,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [host, folder, watching, query, kind]);

  return {
    /** Null until the sidecar has answered. */
    status,
    error,
    /** The search box's words. */
    query,
    setQuery: (next: string) => setFilter({ folder, query: next, kind }),
    /** The one type shown, or null for every type. */
    kind,
    setKind: (next: string | null) => setFilter({ folder, query, kind: next }),
    /** Applies a saved change to the memory or lessons setting to the open sessions, which reload. */
    changed: async () => {
      await host?.request({ type: "memory_changed" }).catch(() => {});
    },
  };
}
