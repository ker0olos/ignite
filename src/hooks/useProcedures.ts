import { useCallback, useEffect, useState } from "react";
import type { Procedure } from "../../shared/procedures";
import type { HostClient } from "@/lib/piHost";

/** Every saved procedure, fetched while the Settings dialog is open, and removing one. */
export function useProcedures(host: HostClient | null, open: boolean) {
  const [procedures, setProcedures] = useState<Procedure[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!host || !open) return;
    let live = true;
    host
      .request({ type: "procedures_list" })
      .then((p) => {
        if (!live) return;
        setProcedures(p);
        setError(null);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [host, open]);

  const remove = useCallback(
    async (procedure: number) => {
      if (!host) return;
      try {
        setProcedures(
          await host.request({ type: "procedures_remove", procedure }),
        );
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [host],
  );

  return { procedures, error, remove };
}
