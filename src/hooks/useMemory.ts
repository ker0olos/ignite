import { useEffect, useState } from "react";
import type { MemoryStatus } from "../../shared/memory";
import type { HostClient } from "@/lib/piHost";

/**
 * cmem's status and the open `folder`'s latest memories, fetched each
 * time `watching` turns on (the settings dialog opening), so they're fresh.
 */
export function useMemory(
  host: HostClient | null,
  folder: string | null,
  watching: boolean,
) {
  const [status, setStatus] = useState<MemoryStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!host || !watching) return;
    let live = true;
    host
      .request({ type: "memory_status", ...(folder && { cwd: folder }) })
      .then((next) => {
        if (!live) return;
        setStatus(next);
        setError(null);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [host, folder, watching]);

  return {
    /** Null until the sidecar has answered. */
    status,
    error,
    /** Applies a saved change to the memory setting to the open session. */
    changed: async () => {
      await host?.request({ type: "memory_changed" }).catch(() => {});
    },
  };
}
