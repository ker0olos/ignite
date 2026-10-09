/**
 * Asks the user before tool calls, as the composer's approval mode says
 * (src/lib/approvalPolicy.ts). The question goes to the host over pi's event
 * bus; a denied call is blocked with a reason the model sees. The mode is
 * read from settings.toml on every call, so switching applies at once.
 * In Auto, shell commands that run without asking run in the OS sandbox
 * (sandbox.ts); when it blocks one, the same call asks to run it outside.
 * Auto with full access asks for nothing and doesn't sandbox.
 */
import { realpath } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import {
  type ExtensionAPI,
  type ExtensionContext,
  type ToolCallEvent,
  type ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
import type { ApprovalRequest } from "../shared/hostProtocol.ts";
import { GH_TOOL, GIT_TOOL } from "../shared/git.ts";
import { ASK_TOOL, type QuestionAnswer } from "../shared/questions.ts";
import { TASK_ADD_TOOL } from "../shared/tasks.ts";
import {
  approvalFor,
  resolvePath,
  type ApprovalGate,
} from "../src/lib/approvalPolicy.ts";
import {
  approvalMode,
  currentSandbox,
  sandboxing,
} from "./approvalSettings.ts";
import { isMcpDirect } from "../src/lib/mcpToolCall.ts";
import { loadBashParser } from "./bashParser.ts";
import {
  blockedProgram,
  blockedReason,
  blockedSummary,
  canAllow,
  isCredential,
  refusedLine,
  shortHome,
  type Sandbox,
} from "./sandbox.ts";
import {
  allowAlways,
  allowRuleFor,
  loadAllowed,
  commandToAllow,
  outsideGuidance,
  runsOnly,
  type AllowRule,
} from "./sandboxAllow.ts";
import { runOutside } from "./runOutside.ts";
import { mayHaveBeenBlocked, stopSandboxed } from "./blockedRun.ts";
import { unplannedWrite, writableUntilPlanned } from "./taskSteps.ts";

// Without these, commands are still checked: as raw text, and for paths
// outside the folder instead of in the sandbox.
const bashParser = loadBashParser().catch((error: unknown) => {
  process.stderr.write(`pi-host: bash parser unavailable: ${error}\n`);
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
    return {
      input,
      place: { cwd, home: homedir(), temp: [tmpdir()], windows },
    };
  }
  const place = {
    cwd: await realPath(cwd),
    home: await realPath(homedir()),
    temp: [...new Set(await Promise.all([tmpdir(), "/tmp"].map(realPath)))],
  };
  const path = await realPath(resolvePath(input.path, place));
  return { input: { ...input, path }, place };
}

function commandOf(event: ToolCallEvent): string | undefined {
  const { command } = event.input as Record<string, unknown>;
  return event.toolName === "bash" && typeof command === "string"
    ? command
    : undefined;
}

/**
 * What to offer to always allow for a blocked command: what it hit, or, when
 * that was a credential (a CLI's token in the keychain), the program and
 * subcommand the command runs by name ("doppler run").
 */
async function ruleFor(
  explained: string,
  command: string,
): Promise<AllowRule | null> {
  const summary = blockedSummary(explained);
  const hit = summary ? allowRuleFor(summary) : null;
  if (!hit) return null;
  if (await canAllow(hit, homedir())) return hit;
  const named = blockedProgram(explained);
  const pipelines = (await bashParser)?.(command);
  if (!named || !pipelines || !isCredential(hit.target, homedir())) return null;
  const target = commandToAllow(pipelines, named);
  if (!target) return null;
  const rule = { kind: "commands" as const, target };
  return (await canAllow(rule, homedir())) ? rule : null;
}

/** How the prompt names `rule` after "Always allow". */
const allowLabel = (rule: AllowRule) =>
  rule.kind === "commands" ? rule.target : shortHome(rule.target, homedir());

/** Whether `command` runs a program the user always lets run outside the sandbox. */
async function runsOutside(command: string): Promise<boolean> {
  const { commands } = await loadAllowed();
  if (!commands.length) return false;
  const pipelines = (await bashParser)?.(command);
  return !!pipelines && runsOnly(pipelines, commands);
}

export default function approval(pi: ExtensionAPI) {
  // Sandboxed runs in progress: tool call id → the command as written, the
  // sandbox it ran in, and whether the folder was read-only (work unplanned).
  type Run = { command: string; box: Sandbox; locked: boolean };
  const sandboxed = new Map<string, Run>();

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
    { command, locked }: Run,
    explained: string,
    what: string,
  ) {
    const folders = [ctx.cwd, await realPath(ctx.cwd)];
    const unplanned = locked && unplannedWrite(explained, folders);
    if (unplanned) return unplanned;
    const rule = await ruleFor(explained, command);
    const { approved, always } = await ask(
      {
        toolCallId: event.toolCallId,
        reason: blockedReason(what),
        ...(rule && { allow: allowLabel(rule) }),
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
    stopSandboxed(event.details, ctx.sessionManager.getSessionId());
    return runOutside(event.toolCallId, { ...event.input, command }, ctx);
  }

  /** Why the call waits for the user, or null to let it run. */
  async function needed(
    event: ToolCallEvent,
    ctx: ExtensionContext,
    mode: ApprovalGate,
    box: Sandbox | undefined,
  ) {
    const { input, place } = await judged(event.input, ctx.cwd);
    return approvalFor(mode, event.toolName, input, place, {
      parse: await bashParser,
      sandboxed: !!box,
      mcpDirect: isMcpDirect(event.toolName, pi.getAllTools()),
    });
  }

  pi.on("tool_call", async (event, ctx) => {
    // Its question already waits for the user; git and gh ask for themselves.
    if (SELF_ASKING.has(event.toolName)) return;
    const mode = await approvalMode();
    const box = mode === "auto" ? await currentSandbox() : undefined;
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
    if (!box || command === undefined || (await runsOutside(command))) return;
    const inside = box.locks
      ? await writableUntilPlanned(pi, ctx.cwd)
      : undefined;
    sandboxed.set(event.toolCallId, { command, box, locked: !!inside });
    const input = event.input as { command: string };
    input.command = await box.wrap(command, ctx.cwd, event.toolCallId, inside);
  });

  // Read once per conversation: a system prompt that changes loses its prompt cache.
  const guidance = new Map<string, Promise<string>>();
  const guidanceFor = async () => {
    if ((await approvalMode()) !== "auto" || !(await sandboxing())) return "";
    const { commands } = await loadAllowed();
    return commands.length ? `\n\n${outsideGuidance(commands)}` : "";
  };
  pi.on("before_agent_start", async (event, ctx) => {
    const session = ctx.sessionManager.getSessionId();
    if (!guidance.has(session)) guidance.set(session, guidanceFor());
    const extra = await guidance.get(session)!;
    return extra ? { systemPrompt: event.systemPrompt + extra } : undefined;
  });

  // Asked before the call ends, so its row shows the question, not a retry.
  pi.on("tool_result", async (event, ctx) => {
    const run = sandboxed.get(event.toolCallId);
    if (!run) return;
    sandboxed.delete(event.toolCallId);
    const { box } = run;
    const text = event.content
      .flatMap((c) => (c.type === "text" ? [c.text] : []))
      .join("\n");
    if (!mayHaveBeenBlocked(event, box, text)) return;
    const explained = await box.explain(event.toolCallId, text);
    const what = blockedSummary(explained) ?? refusedLine(text);
    if (!what) return;
    return askOutside(event, ctx, run, explained, what);
  });
}
