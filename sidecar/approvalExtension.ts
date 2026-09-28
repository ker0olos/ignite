/**
 * Asks the user before tool calls, as the composer's approval mode says
 * (src/lib/approvalPolicy.ts). The question goes to the host over pi's event
 * bus; a denied call is blocked with a reason the model sees. The mode is
 * read from settings.toml on every call, so switching applies at once.
 * In Auto, shell commands that run without asking run in the OS sandbox
 * (sandbox.ts); one the sandbox blocked asks to run outside it when retried.
 */
import { readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
} from "@earendil-works/pi-coding-agent";
import { parse as parseToml } from "smol-toml";
import type { ApprovalMode, ApprovalRequest } from "../shared/hostProtocol.ts";
import { ASK_TOOL, type QuestionAnswer } from "../shared/questions.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { approvalFor, resolvePath } from "../src/lib/approvalPolicy.ts";
import { loadBashParser } from "./bashParser.ts";
import {
  blockedSummary,
  createSandbox,
  refusedLine,
  type Sandbox,
} from "./sandbox.ts";

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
  answer(approved: boolean, answers?: QuestionAnswer[]): void;
};

export const DENIED = "The user denied this tool call.";
export const RETRY_HINT =
  "The sandbox blocked this command. If it must run outside the sandbox, " +
  "run exactly the same command again; the user will be asked to approve it.";

/** The composer's approval mode (`[approval] mode`); Auto unless set to manual. */
export async function approvalMode(
  settingsFile = join(homedir(), `.${APP_NAME}`, "settings.toml"),
): Promise<ApprovalMode> {
  try {
    const settings = parseToml(await readFile(settingsFile, "utf8"));
    const approval = settings.approval as { mode?: unknown } | undefined;
    return approval?.mode === "manual" ? "manual" : "auto";
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

export default function approval(pi: ExtensionAPI) {
  // Commands the sandbox blocked, with what it blocked; retrying one asks.
  const blocked = new Map<string, string>();
  // Sandboxed runs in progress: tool call id → the command as written.
  const sandboxed = new Map<string, string>();

  const ask = (request: ApprovalRequest, ctx: ExtensionContext) =>
    new Promise<boolean>((resolve) => {
      // Stopping the run denies it.
      ctx.signal?.addEventListener("abort", () => resolve(false));
      pi.events.emit(APPROVAL_EVENT, {
        request,
        answer: resolve,
      } satisfies ApprovalAsk);
    });

  /** Why the call waits for the user, or null to let it run. */
  async function needed(
    event: ToolCallEvent,
    ctx: ExtensionContext,
    mode: ApprovalMode,
    box: Sandbox | undefined,
  ) {
    const command = commandOf(event);
    const was = command === undefined ? undefined : blocked.get(command);
    if (box && was) {
      return { reason: `The sandbox blocked it (${was}); run it outside?` };
    }
    const { input, place } = await judged(event.input, ctx.cwd);
    const parse = await bashParser;
    return approvalFor(mode, event.toolName, input, place, {
      parse,
      sandboxed: !!box,
    });
  }

  pi.on("tool_call", async (event, ctx) => {
    // Its question already waits for the user.
    if (event.toolName === ASK_TOOL) return;
    const mode = await approvalMode();
    const box = mode === "auto" ? await sandbox : undefined;
    const command = commandOf(event);
    const wait = await needed(event, ctx, mode, box);
    if (wait) {
      const request = { toolCallId: event.toolCallId, ...wait };
      if (!(await ask(request, ctx))) return { block: true, reason: DENIED };
      // An approved command runs as is, outside the sandbox.
      if (command !== undefined) blocked.delete(command);
      return;
    }
    if (!box || command === undefined) return;
    sandboxed.set(event.toolCallId, command);
    const input = event.input as { command: string };
    input.command = await box.wrap(command, ctx.cwd, event.toolCallId);
  });

  pi.on("tool_result", async (event) => {
    const command = sandboxed.get(event.toolCallId);
    const box = await sandbox;
    if (command === undefined || !box) return;
    sandboxed.delete(event.toolCallId);
    // A command that succeeded wasn't stopped, whatever else macOS logged.
    if (!event.isError) return;
    const text = event.content
      .flatMap((c) => (c.type === "text" ? [c.text] : []))
      .join("\n");
    const explained = await box.explain(event.toolCallId, text);
    const what = blockedSummary(explained) ?? refusedLine(text);
    if (!what) return;
    blocked.set(command, what);
    return {
      content: [{ type: "text", text: `${explained}\n\n${RETRY_HINT}` }],
    };
  });
}
