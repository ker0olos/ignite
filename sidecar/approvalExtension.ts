/**
 * Asks the user before tool calls, as the composer's approval mode says
 * (src/lib/approvalPolicy.ts). The question goes to the host over pi's event
 * bus; a denied call is blocked with a reason the model sees. The mode is
 * read from settings.toml on every call, so switching applies at once.
 */
import { readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { parse as parseToml } from "smol-toml";
import type { ApprovalMode, ApprovalRequest } from "../shared/hostProtocol.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { approvalFor, resolvePath } from "../src/lib/approvalPolicy.ts";
import { loadBashParser } from "./bashParser.ts";

// Without the grammar, commands are still checked, as raw text.
const bashParser = loadBashParser().catch((error: unknown) => {
  process.stderr.write(`pi-host: bash parser unavailable: ${error}\n`);
  return undefined;
});

/** pi event bus channel carrying an ApprovalAsk to the host. */
export const APPROVAL_EVENT = "app/approval";

/** An approval question on the event bus; `answer` settles it. */
export type ApprovalAsk = {
  request: ApprovalRequest;
  answer(approved: boolean): void;
};

export const DENIED = "The user denied this tool call.";

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
async function judged(input: Record<string, unknown>, cwd: string) {
  if (typeof input.path !== "string") {
    return { input, place: { cwd, home: homedir() } };
  }
  const place = { cwd: await realPath(cwd), home: await realPath(homedir()) };
  const path = await realPath(resolvePath(input.path, place));
  return { input: { ...input, path }, place };
}

export default function approval(pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    const { input, place } = await judged(event.input, ctx.cwd);
    const mode = await approvalMode();
    const parse = await bashParser;
    const needed = approvalFor(mode, event.toolName, input, place, parse);
    if (!needed) return;
    const approved = await new Promise<boolean>((resolve) => {
      // Stopping the run denies it.
      ctx.signal?.addEventListener("abort", () => resolve(false));
      pi.events.emit(APPROVAL_EVENT, {
        request: { toolCallId: event.toolCallId, ...needed },
        answer: resolve,
      } satisfies ApprovalAsk);
    });
    return approved ? undefined : { block: true, reason: DENIED };
  });
}
