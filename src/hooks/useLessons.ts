import { useCallback, useEffect, useState } from "react";
import type { Lesson } from "../../shared/lessons";
import type { HostClient } from "@/lib/piHost";

/** Every saved lesson, fetched while the Settings dialog is open, and removing one. */
export function useLessons(host: HostClient | null, open: boolean) {
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!host || !open) return;
    let live = true;
    host
      .request({ type: "lessons_list" })
      .then((l) => {
        if (!live) return;
        setLessons(l);
        setError(null);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [host, open]);

  const remove = useCallback(
    async (lesson: string) => {
      if (!host) return;
      try {
        setLessons(await host.request({ type: "lessons_remove", lesson }));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [host],
  );

  return { lessons, error, remove };
}
