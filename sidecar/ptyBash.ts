/** The agent's background commands, run in a PTY like the user's terminal; the agent reads them as the screen shows them. */
import { getShellConfig } from "@earendil-works/pi-coding-agent";
import { screenText, spawnPty, terminalEnv } from "./ptyShell.ts";

/** A command in a PTY: its pid, and its exit once its output is all passed on. */
type Shell = {
  pid: number;
  done: Promise<{ exitCode: number; signal?: number }>;
  /** The line it's still writing, not yet passed to `onText`. */
  pending: () => string;
};

// No pager or prompt can wait on a user who isn't there.
const UNATTENDED = { PAGER: "cat", GIT_PAGER: "cat", MANPAGER: "cat" };

/**
 * Runs `command` in the user's shell in a PTY. `onText` gets its output as
 * rendered lines; `onRaw`, if given, the terminal stream as is (colors and all).
 */
export function startShell(
  command: string,
  cwd: string,
  env: NodeJS.ProcessEnv | undefined,
  onText: (text: string) => void,
  onRaw?: (data: string) => void,
): Shell {
  const shell = getShellConfig();
  const stdin = shell.commandTransport === "stdin";
  // Output to the terminal, input from nothing: colors, but no prompt waits.
  const script = `exec </dev/null; ${command}`;
  const pty = spawnPty(
    shell.shell,
    stdin ? shell.args : [...shell.args, script],
    {
      cwd,
      env: { ...terminalEnv(env), ...UNATTENDED },
    },
  );
  // ponytail: legacy WSL bash reads its script from the terminal, which echoes it.
  if (stdin) pty.write(`${command}\n\x04`);
  const text = screenText(onText);
  pty.onData((data) => {
    onRaw?.(data);
    text.write(data);
  });
  const done = new Promise<Awaited<Shell["done"]>>((resolve) =>
    pty.onExit(async ({ exitCode, signal }) => {
      await text.end();
      // As a shell reports a command killed by a signal.
      resolve(signal ? { exitCode: 128 + signal, signal } : { exitCode });
    }),
  );
  return { pid: pty.pid, done, pending: text.pending };
}
