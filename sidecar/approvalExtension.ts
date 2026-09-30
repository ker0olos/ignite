/**
 * Asks the user before tool calls, as the composer's approval mode says
 * (src/lib/approvalPolicy.ts). The question goes to the host over pi's event
 * bus; a denied call is blocked with a reason the model sees. The mode is
 * read from settings.toml on every call, so switching applies at once.
 * In Auto and YOLO, shell commands that run without asking run in the OS
 * sandbox (sandbox.ts); when it blocks one, Auto asks to run it outside and
 * YOLO retries outside without asking.
 */
import { readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import {
  createBashTool,
  type ExtensionAPI,
  type ExtensionContext,
  type ToolCallEvent,
  type ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
import { parse as parseToml } from "smol-toml";
import type { ApprovalMode, ApprovalRequest } from "../shared/hostProtocol.ts";
import { GH_TOOL, GIT_TOOL } from "../shared/git.ts";
import { ASK_TOOL, type QuestionAnswer } from "../shared/questions.ts";
import { TASK_ADD_TOOL } from "../shared/tasks.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { approvalFor, resolvePath } from "../src/lib/approvalPolicy.ts";
import { runBackground } from "./bashExtension.ts";
import { loadBashParser } from "./bashParser.ts";
import {
  blockedAction,
  blockedSummary,
  canAllow,
  createSandbox,
  mayBeBlocked,
  refusedLine,
  shortHome,
  type Sandbox,
} from "./sandbox.ts";
import { allowAlways, allowRuleFor } from "./sandboxAllow.ts";

// Without these, commands are still checked: as raw text, and for paths
// outside the folder instead of in the sandbox.
const bashParser = loadBashParser().catch((error: unknown) => {
  process.stderr.write(`pi-host: bash parser unavailable: ${error}\n`);
  return undefined;
});
const sandbox = createSandbox().catch((error: unknown) => {
  process.stderr.write(`pi-host: sandbox unavailable: ${error}\n`);
  return undefined;
});

/** pi event bus channel carrying an ApprovalAsk to the host. */
export const APPROVAL_EVENT = "app/approval";

/** An approval question on the event bus; `answer` settles it. */
export type ApprovalAsk = {
  request: ApprovalRequest;
  /** `always`: the user also allowed the request's `allow` from now on. */
  answer(approved: boolean, answers?: QuestionAnswer[], always?: boolean): void;
  /** Called when the user declined it, not when a stop, close or message denied it. */
  declined?(): void;
};

export const DENIED = "The user denied this tool call.";
export const DECLINED_OUTSIDE =
  "The sandbox blocked this command, and the user declined to run it outside the sandbox.";
const SELF_ASKING = new Set([ASK_TOOL, TASK_ADD_TOOL, GIT_TOOL, GH_TOOL]);

/** The composer's approval mode (`[approval] mode`); Auto unless set to manual or yolo. */
export async function approvalMode(
  settingsFile = join(homedir(), `.${APP_NAME}`, "settings.toml"),
): Promise<ApprovalMode> {
  try {
    const settings = parseToml(await readFile(settingsFile, "utf8"));
    const approval = settings.approval as { mode?: unknown } | undefined;
    return approval?.mode === "manual" || approval?.mode === "yolo"
      ? approval.mode
      : "auto";
  } catch {
    return "auto";
  }
}

/** `path` with symlinks resolved, as far as it exists. */
export async function realPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    const parent = dirname(path);
    if (parent === path) return path;
    return join(await realPath(parent), basename(path));
  }
}

// A symlink inside the folder can point outside it, so file tools are
// judged by where their path really leads. Shell commands are judged by
// their text, against the folder as pi names it.
// ponytail: on Windows, junctions aren't followed; paths are only compared.
async function judged(input: Record<string, unknown>, cwd: string) {
  const windows = process.platform === "win32";
  if (windows || typeof input.path !== "string") {
    return { input, place: { cwd, home: homedir(), windows } };
  }
  const place = { cwd: await realPath(cwd), home: await realPath(homedir()) };
  const path = await realPath(resolvePath(input.path, place));
  return { input: { ...input, path }, place };
}

function commandOf(event: ToolCallEvent): string | undefined {
  const { command } = event.input as Record<string, unknown>;
  return event.toolName === "bash" && typeof command === "string"
    ? command
    : undefined;
}

/** Why a command the sandbox blocked waits for the user. */
function blockedReason(what: string) {
  const action = blockedAction(what, homedir());
  return action
    ? `Auto mode stopped this because it tried to ${action}.`
    : `Auto mode stopped this (${what}).`;
}

// ponytail: pi's default shell, not a shellPath or commandPrefix from pi's settings.
async function runOutside(
  toolCallId: string,
  input: Record<string, unknown>,
  ctx: ExtensionContext,
) {
  try {
    if (input.background) {
      const done = await runBackground(toolCallId, input as never, ctx);
      return { ...done, isError: false };
    }
    const bash = createBashTool(ctx.cwd);
    const done = await bash.execute(toolCallId, input as never, ctx.signal);
    return { content: done.content, details: done.details, isError: false };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text" as const, text }], isError: true };
  }
}

export default function approval(pi: ExtensionAPI) {
  // Sandboxed runs in progress: tool call id → the command as written.
  const sandboxed = new Map<string, string>();

  const ask = (request: ApprovalRequest, ctx: ExtensionContext) =>
    new Promise<{ approved: boolean; always?: boolean }>((resolve) => {
      // Stopping the run denies it.
      ctx.signal?.addEventListener("abort", () => resolve({ approved: false }));
      pi.events.emit(APPROVAL_EVENT, {
        request,
        answer: (approved, _answers, always) => resolve({ approved, always }),
      } satisfies ApprovalAsk);
    });

  /** Asks to run a blocked command outside, offering to always allow what it hit. */
  async function askOutside(
    event: ToolResultEvent,
    ctx: ExtensionContext,
    command: string,
    explained: string,
    what: string,
  ) {
    const summary = blockedSummary(explained);
    const found = summary ? allowRuleFor(summary) : null;
    const rule = found && (await canAllow(found, homedir())) ? found : null;
    const yolo = (await approvalMode()) === "yolo";
    const { approved, always } = yolo
      ? { approved: true, always: false }
      : await ask(
          {
            toolCallId: event.toolCallId,
            reason: blockedReason(what),
            ...(rule && { allow: shortHome(rule.target, homedir()) }),
          },
          ctx,
        );
    if (!approved) {
      return {
        content: [
          {
            type: "text" as const,
            text: `${explained}\n\n${DECLINED_OUTSIDE}`,
          },
        ],
      };
    }
    // The user approved this run either way; a failed save only loses "always".
    if (always && rule) {
      await allowAlways(rule).catch((error: unknown) => {
        process.stderr.write(
          `pi-host: sandbox allowlist not saved: ${error}\n`,
        );
      });
    }
    return runOutside(event.toolCallId, { ...event.input, command }, ctx);
  }

  /** Why the call waits for the user, or null to let it run. */
  async function needed(
    event: ToolCallEvent,
    ctx: ExtensionContext,
    mode: ApprovalMode,
    box: Sandbox | undefined,
  ) {
    const { input, place } = await judged(event.input, ctx.cwd);
    const parse = await bashParser;
    return approvalFor(mode, event.toolName, input, place, {
      parse,
      sandboxed: !!box,
    });
  }

  pi.on("tool_call", async (event, ctx) => {
    // Its question already waits for the user; git and gh ask for themselves.
    if (SELF_ASKING.has(event.toolName)) return;
    const mode = await approvalMode();
    const box = mode === "auto" || mode === "yolo" ? await sandbox : undefined;
    const command = commandOf(event);
    const wait = await needed(event, ctx, mode, box);
    if (wait) {
      const request = { toolCallId: event.toolCallId, ...wait };
      if (!(await ask(request, ctx)).approved) {
        return { block: true, reason: DENIED };
      }
      // An approved command runs as is, outside the sandbox.
      return;
    }
    if (!box || command === undefined) return;
    sandboxed.set(event.toolCallId, command);
    const input = event.input as { command: string };
    input.command = await box.wrap(command, ctx.cwd, event.toolCallId);
  });

  // Asked before the call ends, so its row shows the question, not a retry.
  pi.on("tool_result", async (event, ctx) => {
    const command = sandboxed.get(event.toolCallId);
    const box = await sandbox;
    if (command === undefined || !box) return;
    sandboxed.delete(event.toolCallId);
    const text = event.content
      .flatMap((c) => (c.type === "text" ? [c.text] : []))
      .join("\n");
    // A command that succeeded wasn't stopped, whatever else macOS logged,
    // unless its output says something was refused.
    if (!event.isError && !mayBeBlocked(text)) return;
    // Left running, so asking would start a second copy.
    if ((event.details as { background?: unknown } | undefined)?.background) {
      return;
    }
    const explained = await box.explain(event.toolCallId, text);
    const what = blockedSummary(explained) ?? refusedLine(text);
    if (!what) return;
    return askOutside(event, ctx, command, explained, what);
  });
}
