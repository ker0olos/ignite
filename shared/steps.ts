import { ASK_TOOL } from "./questions.ts";
import { TASK_TOOL } from "./tasks.ts";

const STEP_LENGTH = 60;

const clip = (text: string) =>
  text.length > STEP_LENGTH ? `${text.slice(0, STEP_LENGTH - 1)}…` : text;

// A command's first line, without the `cd <dir> &&` agents start with.
const commandLine = (command: string) =>
  command
    .split("\n")[0]
    .replace(/^\s*cd\s+\S+\s*&&\s*/, "")
    .trim();

type Input = Record<string, unknown>;

const inFolder = (path: string, cwd: string) =>
  path.startsWith(`${cwd}/`) ? path.slice(cwd.length + 1) : path;

const onPath = (verb: string) => (input: Input, cwd: string) =>
  typeof input.path === "string"
    ? `${verb} ${inFolder(input.path, cwd)}`
    : null;

const running = (tool: string) => (input: Input) =>
  Array.isArray(input.args) ? `Running ${tool} ${input.args.join(" ")}` : null;

const STEPS: Record<string, (input: Input, cwd: string) => string | null> = {
  bash: ({ command }) =>
    typeof command === "string" ? `Running ${commandLine(command)}` : null,
  read: onPath("Reading"),
  edit: onPath("Editing"),
  write: onPath("Writing"),
  git: running("git"),
  gh: running("gh"),
  grep: () => "Searching the code",
  find: () => "Searching the code",
  ls: () => "Searching the code",
};

/** A tool call as the current step ("Reading app/root.tsx"); null for the task's own tools. */
export function stepOf(
  toolName: string,
  input: Input,
  cwd: string,
): string | null {
  if (toolName === TASK_TOOL || toolName === ASK_TOOL) return null;
  const step = STEPS[toolName]?.(input, cwd) ?? `Using ${toolName}`;
  return clip(step);
}
