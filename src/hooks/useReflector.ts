import { useCallback, useEffect, useState } from "react";
import type { Reflection } from "../../shared/reflector";
import type { HostClient } from "@/lib/piHost";

/** The reflector's points, fetched while the Settings dialog is open, and removing or editing one. */
export function useReflector(host: HostClient | null, open: boolean) {
  const [reflections, setReflections] = useState<Reflection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!host || !open) return;
    let live = true;
    host
      .request({ type: "reflections_list" })
      .then((r) => {
        if (!live) return;
        setReflections(r);
        setError(null);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [host, open]);

  const change = useCallback(
    async (run: (host: HostClient) => Promise<Reflection[]>) => {
      if (!host) return;
      try {
        setReflections(await run(host));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [host],
  );

  const remove = useCallback(
    (reflection: string) =>
      change((h) => h.request({ type: "reflections_remove", reflection })),
    [change],
  );
  const edit = useCallback(
    (reflection: string, text: string) =>
      change((h) => h.request({ type: "reflections_edit", reflection, text })),
    [change],
  );

  return { reflections, error, remove, edit };
}
