/** The adb tool's name, and reading its arguments (used by both). */
export const ADB_TOOL = "adb";

// Global options that take a value: -s serial, -t transport, -H host, -P port, -L socket.
const WITH_VALUE = new Set(["-s", "-t", "-H", "-P", "-L"]);

/** adb's command (`push`, `shell`…) and the arguments after it; null when there is none. */
export function adbCommand(
  args: string[],
): { name: string; rest: string[] } | null {
  for (let i = 0; i < args.length; i++) {
    if (WITH_VALUE.has(args[i])) i++;
    else if (!args[i].startsWith("-")) {
      return { name: args[i], rest: args.slice(i + 1) };
    }
  }
  return null;
}

// Commands whose every path argument is on this computer.
const ALL_LOCAL = new Set([
  "install",
  "install-multiple",
  "install-multi-package",
  "backup",
  "restore",
  "bugreport",
]);

/** The paths on this computer an adb call reads or writes. */
export function adbHostPaths(args: string[]): string[] {
  const command = adbCommand(args);
  if (!command) return [];
  const paths = command.rest.filter((a) => !a.startsWith("-"));
  if (command.name === "push") return paths.slice(0, -1);
  if (command.name === "pull") return paths.length > 1 ? paths.slice(-1) : [];
  return ALL_LOCAL.has(command.name) ? paths : [];
}

const EXITS_LOGCAT = new Set(["-d", "-c", "-g", "-t", "--clear"]);

/** logcat's arguments, run directly or as `shell logcat`; null for other calls. */
function logcatArgs(command: {
  name: string;
  rest: string[];
}): string[] | null {
  if (command.name === "logcat") return command.rest;
  if (command.name === "shell" && command.rest[0] === "logcat") {
    return command.rest.slice(1);
  }
  return null;
}

/** Why an adb call would never exit, or null. */
export function adbNeverExits(args: string[]): string | null {
  const command = adbCommand(args);
  if (!command) return null;
  if (command.name === "shell" && command.rest.length === 0) {
    return "`adb shell` with no command waits for input. Pass the command to run.";
  }
  const logcat = logcatArgs(command);
  if (logcat && !logcat.some((a) => EXITS_LOGCAT.has(a))) {
    return "`adb logcat` keeps streaming. Pass -d to dump the log and exit (or -t <count>).";
  }
  return null;
}
