import { useCallback, useEffect, useState } from "react";
import type { FallbackKeyInfo } from "../../shared/fallbackKeys";
import type { HostClient } from "@/lib/piHost";

/** The fallback API keys, fetched while `open`: adding, removing and reordering them. */
export function useFallbackKeys(host: HostClient | null, open: boolean) {
  const [keys, setKeys] = useState<FallbackKeyInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!host || !open) return;
    let live = true;
    host
      .request({ type: "fallback_keys" })
      .then((k) => {
        if (!live) return;
        setKeys(k);
        setError(null);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [host, open]);

  const remove = useCallback(
    async (key: string) => {
      if (!host) return;
      try {
        setKeys(await host.request({ type: "fallback_key_remove", key }));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [host],
  );

  const move = useCallback(
    async (key: string, by: -1 | 1) => {
      if (!host) return;
      try {
        setKeys(await host.request({ type: "fallback_key_move", key, by }));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [host],
  );

  /** Rejects with the host's message so the form can show it. */
  const add = useCallback(
    async (apiKey: string) => {
      if (!host) throw new Error("The agent host isn't running.");
      setKeys(await host.request({ type: "fallback_key_add", apiKey }));
      setError(null);
    },
    [host],
  );

  return { keys, error, add, remove, move };
}
