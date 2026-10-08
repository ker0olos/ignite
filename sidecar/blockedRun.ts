/** A sandboxed bash result: whether the sandbox may have blocked it, and ending its background copy before a rerun outside. */
import type { ToolResultEvent } from "@earendil-works/pi-coding-agent";
import { stopBackground } from "./backgroundBash.ts";
import { mayBeBlocked, type Sandbox } from "./sandbox.ts";

type Ran = { background?: { pid?: unknown }; skipped?: unknown };

/** Whether the result may come from the sandbox blocking the run; never for one the user skipped, which a rerun would start again. */
export function mayHaveBeenBlocked(
  event: ToolResultEvent,
  box: Sandbox,
  text: string,
) {
  if ((event.details as Ran | undefined)?.skipped) return false;
  return (
    event.isError || mayBeBlocked(text) || box.sendRefused(event.toolCallId)
  );
}

// ponytail: the rerun starts while the old one is still being killed (up to 3s), so a dev server may find its port taken once.
/** Ends the sandboxed copy of a background command still running, so running it outside doesn't start a second. */
export function stopSandboxed(details: unknown, session: string) {
  const pid = (details as Ran | undefined)?.background?.pid;
  if (typeof pid === "number") stopBackground(pid, session);
}
