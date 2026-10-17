import { useCallback, useEffect, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exit } from "@tauri-apps/plugin-process";
import type { AppVersion } from "../../shared/hostProtocol";
import type { UpdateState } from "@/lib/about";
import { confirmRestart } from "@/lib/lifecycle";
import type { HostClient } from "@/lib/piHost";

const RELOAD = "app://reload";
const reloadPage = () => location.reload();
// Started by the launcher, the main window builds updates in the background.
const AUTO = __HEALTH_FILE__ !== null && getCurrentWindow().label === "main";
const FIRST_CHECK_MS = 30_000;
const CHECK_EVERY_MS = 6 * 60 * 60_000;

/**
 * The commit the app runs from, fetched once the sidecar is up and again
 * each time `watching` turns on, and an update check. An update reloads
 * every window, which also restarts each one's sidecar on the new code; one
 * the launcher runs is built in the background instead, then `ready`.
 */
export function useAbout(
  host: HostClient | null,
  watching: boolean,
  reload = reloadPage,
  auto = AUTO,
  quit = exit,
  confirm = confirmRestart,
) {
  const [version, setVersion] = useState<AppVersion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateState>("idle");
  const [warning, setWarning] = useState<string | null>(null);
  const checking = useRef(false);

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
        setUpdate((u) =>
          u === "checking" || u === "updated" || u === "ready" ? u : "idle",
        );
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [host, watching]);

  // A built update stays ready, to restart into, whatever a later check finds.
  const check = useCallback(async () => {
    if (!host || checking.current) return;
    checking.current = true;
    setUpdate((u) => (u === "ready" ? u : "checking"));
    try {
      const result = await host.request({ type: "app_update" });
      const { updated, ready } = result;
      if (result.warning) setWarning(result.warning);
      setUpdate(ready ? "ready" : updated ? "updated" : "up-to-date");
      if (updated) await emit(RELOAD);
    } catch (e) {
      setUpdate((u) => (u === "ready" ? u : { error: (e as Error).message }));
    } finally {
      checking.current = false;
    }
  }, [host]);

  useEffect(() => {
    if (!host || !auto) return;
    const first = setTimeout(check, FIRST_CHECK_MS);
    const every = setInterval(check, CHECK_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [host, auto, check]);

  const restart = useCallback(async () => {
    if (!host || !(await confirm())) return;
    await host.request({ type: "app_restart" });
    await quit(0);
  }, [host, quit, confirm]);

  return {
    /** Null until the sidecar has answered. */
    version,
    error,
    update,
    /** Why the ready update's binary couldn't be verified, if it couldn't. */
    warning,
    /** Gets the latest code; reloads every window, or readies it for a restart. */
    check,
    /** Quits, and the launcher starts the built update. */
    restart,
  };
}
