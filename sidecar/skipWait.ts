/** Skip wait: the user cuts a foreground bash call's `sleep` short, and the command carries on as if it had slept. */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import type { BashSpawnHook } from "@earendil-works/pi-coding-agent";
import { APP_NAME } from "../src/lib/app.ts";

const ROOT = join(tmpdir(), `${APP_NAME}-sleep`);
const BIN = join(ROOT, "bin");

// Stands in for sleep on PATH; ended by Skip wait, it exits 0, so `sleep 60 && next` runs next.
const SHIM = `#!/bin/sh
"$IGNITE_SLEEP" "$@" &
pid=$!
mark="$IGNITE_SLEEPS/$$"
trap 'kill $pid 2>/dev/null; rm -f "$mark"; exit 0' TERM
mkdir -p "$IGNITE_SLEEPS" && : > "$mark"
wait $pid
status=$?
rm -f "$mark"
exit $status
`;

/** The real sleep on the sidecar's PATH. */
const realSleep = () =>
  (process.env.PATH ?? "")
    .split(delimiter)
    .map((dir) => join(dir, "sleep"))
    .find((path) => path !== join(BIN, "sleep") && existsSync(path));

/** Where a call's running sleeps leave their pids. */
const sleepsOf = (toolCallId: string) =>
  join(ROOT, toolCallId.replace(/[^\w-]/g, "_"));

/** Puts the shim on PATH for one call; on Windows (or with no sleep found) it leaves the call as is. */
function sleepHook(toolCallId: string): BashSpawnHook | undefined {
  const real = realSleep();
  if (process.platform === "win32" || !real) return undefined;
  const shim = join(BIN, "sleep");
  // Written once: rewriting it under a shell running it could break that run.
  if (!existsSync(shim)) {
    mkdirSync(BIN, { recursive: true });
    writeFileSync(shim, SHIM, { mode: 0o755 });
  }
  return (context) => ({
    ...context,
    env: {
      ...context.env,
      PATH: `${BIN}${delimiter}${context.env.PATH ?? ""}`,
      IGNITE_SLEEP: real,
      IGNITE_SLEEPS: sleepsOf(toolCallId),
    },
  });
}

/** Runs a foreground bash call whose sleeps `skipWait` can end. */
export async function skippable<T>(
  toolCallId: string,
  run: (spawnHook: BashSpawnHook | undefined) => Promise<T>,
): Promise<T> {
  try {
    return await run(sleepHook(toolCallId));
  } finally {
    rmSync(sleepsOf(toolCallId), { recursive: true, force: true });
  }
}

/** Ends the sleeps a running bash call is waiting on; false when it's in none. */
export function skipWait(toolCallId: string): boolean {
  let ended = false;
  for (const pid of readdirSafe(sleepsOf(toolCallId))) {
    try {
      process.kill(Number(pid), "SIGTERM");
      ended = true;
    } catch {
      // Already done.
    }
  }
  return ended;
}

function readdirSafe(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
