import { useCallback, useEffect, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import type { AppVersion } from "../../shared/hostProtocol";
import type { UpdateState } from "@/lib/about";
import type { HostClient } from "@/lib/piHost";

const RELOAD = "app://reload";
const reloadPage = () => location.reload();

/**
 * The commit the app runs from, fetched once the sidecar is up and again
 * each time `watching` turns on, and an update check. An update reloads every window, which also restarts each
 * one's sidecar on the new code.
 */
export function useAbout(
  host: HostClient | null,
  watching: boolean,
  reload = reloadPage,
) {
  const [version, setVersion] = useState<AppVersion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateState>("idle");

  useEffect(() => {
    const unlisten = listen(RELOAD, reload);
    return () => {
      unlisten.then((f) => f());
    };
  }, [reload]);

  useEffect(() => {
    if (!host) return;
    let live = true;
    host
      .request({ type: "app_version" })
      .then((v) => {
        if (!live) return;
        setVersion(v);
        setError(null);
        // A finished check's result is from the last time Settings was open.
        setUpdate((u) => (u === "checking" || u === "updated" ? u : "idle"));
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [host, watching]);

  const check = useCallback(async () => {
    if (!host) return;
    setUpdate("checking");
    try {
      const { updated } = await host.request({ type: "app_update" });
      setUpdate(updated ? "updated" : "up-to-date");
      if (updated) await emit(RELOAD);
    } catch (e) {
      setUpdate({ error: (e as Error).message });
    }
  }, [host]);

  return {
    /** Null until the sidecar has answered. */
    version,
    error,
    update,
    /** Pulls the latest code; reloads every window if anything changed. */
    check,
  };
}
