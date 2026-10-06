/** Foreground bash calls the user can stop waiting on: the command ends and the agent carries on. */
import { APP_NAME } from "../src/lib/app.ts";

// On globalThis: the host and each session's extensions load their own copy.
const shared = globalThis as { [key: symbol]: Map<string, AbortController> };
const waits = (shared[Symbol.for(`${APP_NAME}.skipWait`)] ??= new Map());

const SKIPPED =
  "The user stopped waiting, so the command was ended here. Take what it printed so far as done and carry on.";

// How pi's bash fails once its signal aborts: before it starts, or with the output so far.
const ABORTED = /^aborted$|(?:^|\n\n)Command aborted$/;

type Text = { type: "text"; text: string };
type Skipped = {
  content: Text[];
  details: { skipped: true };
  isError: false;
};

/**
 * Runs a bash call with a signal `skipWait` also aborts; skipped, it returns
 * the output so far as its result instead of failing the run.
 */
export async function skippable<T>(
  toolCallId: string,
  signal: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T | Skipped> {
  const wait = new AbortController();
  waits.set(toolCallId, wait);
  try {
    return await run(
      signal ? AbortSignal.any([signal, wait.signal]) : wait.signal,
    );
  } catch (error) {
    const output = error instanceof Error ? error.message : String(error);
    const skipped = wait.signal.aborted && !signal?.aborted;
    if (!skipped || !ABORTED.test(output)) throw error;
    const text = output.replace(ABORTED, (m) =>
      m.startsWith("\n\n") ? `\n\n${SKIPPED}` : SKIPPED,
    );
    return {
      content: [{ type: "text", text }],
      details: { skipped: true },
      isError: false,
    };
  } finally {
    waits.delete(toolCallId);
  }
}

/** Ends a running foreground bash call; false when none runs under that id. */
export function skipWait(toolCallId: string): boolean {
  const wait = waits.get(toolCallId);
  wait?.abort();
  return !!wait;
}
