/**
 * Records pi sessions in cmem the way its Claude Code hooks do, and adds
 * the context it recalls for the folder to the system prompt. Talks to
 * cmem's local worker over HTTP. Checked before each run, so turning it
 * off in Settings, a stopped worker or an excluded folder skip that run.
 */
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { APP_NAME } from "../src/lib/app.ts";
import { findWorker, memoryEnabled, projectOf } from "./cmem.ts";
// An agent works in its worktree; its memories are its folder's.
import { folderOf } from "./worktreeGit.ts";

type Content = { type: string; text?: string }[];

const textOf = (content: Content) =>
  content
    .flatMap((c) => (c.type === "text" && c.text ? [c.text] : []))
    .join("\n");

/** The text of the run's last assistant message, as cmem's Stop hook sends it. */
export function lastAssistantText(messages: unknown[]): string {
  const last = (messages as { role?: string; content?: unknown }[])
    .filter((m) => m.role === "assistant" && Array.isArray(m.content))
    .at(-1);
  return last ? textOf(last.content as Content) : "";
}

/** `context` without cmem's work-state section, which would make it the agent's to-do list instead of tasks. */
export const withoutWorkState = (context: string): string =>
  context.replace(/^# Work state\b[\s\S]*?(?=^# |(?![\s\S]))/m, "");

// No platformSource: recall what Claude Code and other tools learned too.
async function recall(url: string, cwd: string): Promise<string> {
  const project = encodeURIComponent(projectOf(cwd));
  return fetch(`${url}/api/context/inject?projects=${project}`, {
    signal: AbortSignal.timeout(5000),
  })
    .then((r) => (r.ok ? r.text() : ""))
    .then(withoutWorkState)
    .catch(() => "");
}

export default function cmem(pi: ExtensionAPI) {
  let url: string | undefined;
  // Recalled once per session, on its first run.
  let context: string | undefined;
  let initialized: Promise<unknown> = Promise.resolve();

  const post = (path: string, ctx: ExtensionContext, body: object) =>
    fetch(`${url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentSessionId: ctx.sessionManager.getSessionId(),
        platformSource: APP_NAME,
        ...body,
      }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => undefined);

  pi.on("session_start", () => {
    context = undefined;
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const folder = folderOf(ctx.cwd);
    url = (await memoryEnabled()) ? (await findWorker(folder)).url : undefined;
    if (!url) return;
    context ??= (await recall(url, folder)).trim();
    initialized = post("/api/sessions/init", ctx, {
      project: projectOf(folder),
      prompt: event.prompt,
    });
    if (context) {
      return { systemPrompt: `${event.systemPrompt}\n\n${context}` };
    }
  });

  pi.on("tool_result", (event, ctx) => {
    if (!url) return;
    void initialized.then(() =>
      post("/api/sessions/observations", ctx, {
        tool_name: event.toolName,
        tool_input: event.input,
        tool_response: textOf(event.content),
        tool_use_id: event.toolCallId,
        cwd: folderOf(ctx.cwd),
      }),
    );
  });

  pi.on("agent_end", (event, ctx) => {
    if (!url) return;
    void initialized.then(() =>
      post("/api/sessions/summarize", ctx, {
        last_assistant_message: lastAssistantText(event.messages),
      }),
    );
  });

  // A reload (after an MCP change) keeps the same conversation going.
  pi.on("session_shutdown", (event, ctx) => {
    if (!url || event.reason === "reload") return;
    void post("/api/sessions/session-end", ctx, {
      reason: event.reason,
      cwd: folderOf(ctx.cwd),
    });
  });
}
