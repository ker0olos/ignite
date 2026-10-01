/**
 * pi's bash with `background: true` for commands that keep running (dev
 * servers, watchers), and bash_stop to end them. Still the `bash` tool, so
 * approval and the sandbox treat it as any other command.
 */
import {
  createBashToolDefinition,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { BASH_STOP_TOOL } from "../shared/agentTypes.ts";
import {
  backgroundOf,
  backgroundOperations,
  forgetBackground,
  STARTUP_MS,
  stopBackground,
  type Background,
} from "./backgroundBash.ts";

const BACKGROUND = Type.Optional(
  Type.Boolean({
    description:
      "Keep it running in the background (dev servers, watchers, anything that doesn't exit). " +
      `Returns after ${STARTUP_MS / 1000}s with its output so far, its pid and a log file to read later. ` +
      `End it with ${BASH_STOP_TOOL}.`,
  }),
);

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
  const done = await bash.execute(toolCallId, input, signal, undefined, ctx);
  if (!started) return done;
  const text = (done.content[0] as { text: string }).text;
  return {
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
    }),
    async execute(id, { background, ...input }, signal, onUpdate, ctx) {
      if (!background) return builtin.execute(id, input, signal, onUpdate, ctx);
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

  // A reload (after an MCP change) keeps the same conversation going.
  pi.on("session_shutdown", (event, ctx) => {
    if (event.reason !== "reload") {
      forgetBackground(ctx.sessionManager.getSessionId());
    }
  });
}
