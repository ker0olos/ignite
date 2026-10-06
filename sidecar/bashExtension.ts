/**
 * pi's bash with `background: true` for commands that keep running (dev
 * servers, watchers), and bash_stop to end them. Still the `bash` tool, so
 * approval and the sandbox treat it as any other command.
 */
import {
  createBashToolDefinition,
  type ExtensionAPI,
  type ExtensionContext,
  type ExtensionToolContext,
} from "@earendil-works/pi-coding-agent";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type } from "typebox";
import { APP_NAME } from "../src/lib/app.ts";
import { BASH_STOP_TOOL } from "../shared/agentTypes.ts";
import {
  backgroundOf,
  backgroundOperations,
  forgetBackground,
  STARTUP_MS,
  stopBackground,
  type Background,
} from "./backgroundBash.ts";
import { skippable } from "./skipWait.ts";
import { REASON, withoutReason } from "./toolReason.ts";

const BACKGROUND = Type.Optional(
  Type.Boolean({
    description:
      "Keep it running in the background (dev servers, watchers, anything that doesn't exit). " +
      `Returns after ${STARTUP_MS / 1000}s with its output so far, its pid and a log file to read later. ` +
      `End it with ${BASH_STOP_TOOL}.`,
  }),
);

export const COMMAND_GUIDANCE = `## Running commands
Run the commands a task needs yourself with bash (setup steps, cloud and deploy CLIs, installs, migrations) instead of handing them to the user; the app asks the user to approve the ones that need it.
Leave a command to the user only when they have to run it themselves: an interactive sign-in or a secret they type, a production or billing change they should make with their own hands, or when they ask. Then give it in a \`\`\`bash block they can run in one click as is: variables set at the top, no placeholders, no "$ " prompts or output mixed in. It runs in the user's own folder, not a worktree of yours, so it can't use files you changed there until they're merged.`;

/** In a task, which runs with nobody watching: what needs the user goes in the final reply. */
export const TASK_COMMAND_GUIDANCE = `## Running commands
Run the commands the task needs yourself with bash; the app asks the user to approve the ones that need it. If one has to be the user's (an interactive sign-in, a secret they type, a production or billing change), don't leave it as a code block nobody runs: finish what you can, and name it in your final reply as what the task still needs from them.`;

/** A conversation's own temp folder, for files that don't belong in the folder. */
export const scratchpad = (session: string) =>
  join(tmpdir(), `${APP_NAME}-scratchpad`, session);

/** Where the agent keeps throwaway files. */
export const scratchGuidance = (scratch: string) => `## Scratchpad
Keep temporary files (probe scripts, screenshots, intermediate output) in ${scratch} instead of the folder or /tmp; it's yours alone, and in Auto, file tools use it without asking.`;

const startedText = (b: Background) =>
  `Still running in the background as pid ${b.pid}. Its output goes to ${b.log}; ` +
  `read it with tail, and end it with ${BASH_STOP_TOOL}.`;

/**
 * Runs `input` in the background; also used when the sandbox blocked it and
 * the user approved running it outside. `command` is how the agent wrote it,
 * when `input`'s is the sandbox's rewrite.
 */
export async function runBackground(
  toolCallId: string,
  input: { command: string; timeout?: number },
  ctx: ExtensionContext,
  signal = ctx.signal,
  command = input.command,
) {
  let started: Background | undefined;
  const session = ctx.sessionManager.getSessionId();
  const bash = createBashToolDefinition(ctx.cwd, {
    operations: backgroundOperations(
      { session, command },
      (b) => (started = b),
    ),
  });
  // pi's bash reads only ExtensionContext fields, never tools or executeTool.
  const toolCtx = ctx as ExtensionToolContext;
  const done = await bash.execute(
    toolCallId,
    input,
    signal,
    undefined,
    toolCtx,
  );
  if (!started || done.isError) return done;
  const text = (done.content[0] as { text: string }).text;
  return {
    ...done,
    details: { ...done.details, background: started },
    content: [
      { type: "text" as const, text: `${text}\n\n${startedText(started)}` },
    ],
  };
}

// ponytail: pi's default shell, not a shellPath or commandPrefix from pi's settings.
export default function bash(pi: ExtensionAPI) {
  const builtin = createBashToolDefinition(process.cwd());
  // Loaded before the approval extension, so this sees the command before
  // the sandbox rewrites it.
  const written = new Map<string, string>();
  pi.on("tool_call", (event) => {
    const { command, background } = event.input as Record<string, unknown>;
    if (
      event.toolName === "bash" &&
      background &&
      typeof command === "string"
    ) {
      written.set(event.toolCallId, command);
    }
  });
  // A call that was denied or blocked never ran to take its entry.
  pi.on("tool_result", (event) => void written.delete(event.toolCallId));
  pi.registerTool({
    ...builtin,
    parameters: Type.Object({
      ...builtin.parameters.properties,
      background: BACKGROUND,
      reason: REASON,
    }),
    async execute(id, params, signal, onUpdate, ctx) {
      const { background, ...input } = withoutReason(params);
      if (!background) {
        return skippable(id, signal, (s) =>
          builtin.execute(id, input, s, onUpdate, ctx),
        );
      }
      const command = written.get(id);
      written.delete(id);
      return runBackground(id, input, ctx, signal, command);
    },
  });

  pi.registerTool({
    name: BASH_STOP_TOOL,
    label: "Stop background command",
    description:
      "End a command started with bash's `background: true`, and everything it started.",
    promptSnippet: `${BASH_STOP_TOOL}: end a background bash command`,
    parameters: Type.Object({
      pid: Type.Number({ description: "The pid bash reported." }),
    }),
    async execute(_id, { pid }, _signal, _onUpdate, ctx) {
      const session = ctx.sessionManager.getSessionId();
      if (stopBackground(pid, session)) {
        return {
          content: [{ type: "text", text: `Stopped ${pid}.` }],
          details: {},
        };
      }
      const left = backgroundOf(session)
        .filter((b) => b.running)
        .map((b) => b.pid);
      throw new Error(
        `No background command ${pid} here. Running: ${left.join(", ") || "none"}.`,
      );
    },
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const scratch = scratchpad(ctx.sessionManager.getSessionId());
    await mkdir(scratch, { recursive: true });
    return {
      systemPrompt: `${event.systemPrompt}\n\n${COMMAND_GUIDANCE}\n\n${scratchGuidance(scratch)}`,
    };
  });

  // A reload (after an MCP change) keeps the same conversation going.
  pi.on("session_shutdown", (event, ctx) => {
    if (event.reason !== "reload") {
      forgetBackground(ctx.sessionManager.getSessionId());
    }
  });
}
