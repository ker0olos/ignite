/**
 * pi-claude-bridge, with the Claude Code it runs kept to what the user set up.
 * Left alone, it loads the worktree's `.claude/settings*.json` (hooks, helpers)
 * and `.pi/claude-bridge.json` (the program to run), which the agent can write,
 * and runs them outside its sandbox. Not a pnpm patch: a launcher version stages
 * the next with its own code, which installs packages without `patches/`.
 */
import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { mkdirSync } from "node:fs";
import bridge, { __test } from "pi-claude-bridge/src/index.ts";

/** A bridge query's options as Ignite runs them: user settings only, no hooks, the SDK's own Claude Code. */
export function guarded(options: Options = {}): Options {
  // Never the worktree's .pi/claude-bridge.json choice; Ignite clears the global one too (claudeCode.ts).
  const rest = { ...options };
  delete rest.pathToClaudeCodeExecutable;
  const settings = typeof rest.settings === "object" ? rest.settings : {};
  return {
    ...rest,
    settingSources: (rest.settingSources ?? ["user"]).filter(
      (s) => s === "user",
    ),
    settings: { ...settings, disableAllHooks: true },
  };
}

export default function claudeBridge(pi: ExtensionAPI) {
  // Fails closed: a bridge without its query seam would run the worktree's settings.
  if (typeof __test?.setQuery !== "function")
    throw new Error("pi-claude-bridge no longer lets Ignite guard its queries");
  __test.setQuery((params) =>
    query({ ...params, options: guarded(params.options) }),
  );
  retryUncaptured(pi);
  // It reads its config from process.cwd() as it loads: agentDir has no .pi/ of its own.
  const at = process.cwd();
  // Not there yet on a first launch, before pi writes into it.
  mkdirSync(getAgentDir(), { recursive: true });
  process.chdir(getAgentDir());
  try {
    return bridge(pi);
  } finally {
    process.chdir(at);
  }
}

// A session's first prompt can race tools registering (the MCP adapter's), which rebuilds the prompt
// the bridge recorded; the next turn records it again, so the run goes on once, without the failed reply.
/** Runs a turn the bridge refused for want of its system prompt (prompt-capture) once more, per message that started the run. */
export function retryUncaptured(pi: Pick<ExtensionAPI, "on">) {
  let retriedFor: string | null = null;
  pi.on("agent_before_settle", (event, ctx) => {
    if (event.outcome !== "error") return;
    const branch = ctx.sessionManager.getBranch();
    const last = branch.at(-1);
    if (last?.type !== "message" || last.message.role !== "assistant") return;
    // Its other refusals (a prompt it won't send, pi#5581's) come back the same on another try.
    if (
      !last.message.errorMessage?.startsWith("prompt-capture: no capture for")
    )
      return;
    // The user's message, or a hidden one (a wake, a nudge) that started the run.
    const started =
      branch.findLast(
        (e) =>
          e.type === "custom_message" ||
          (e.type === "message" && e.message.role === "user"),
      )?.id ?? "";
    if (started === retriedFor) return;
    retriedFor = started;
    return {
      continue: true,
      entries: [
        ...event.entries,
        { type: "context_edit", targetId: last.id, replacement: null },
      ],
    };
  });
}
