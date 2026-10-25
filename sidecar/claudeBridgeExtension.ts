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
  // It reads its config from process.cwd() as it loads: agentDir has no .pi/ of its own.
  const at = process.cwd();
  process.chdir(getAgentDir());
  try {
    return bridge(pi);
  } finally {
    process.chdir(at);
  }
}
