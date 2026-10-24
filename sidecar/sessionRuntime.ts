import {
  type AgentSession,
  ModelRuntime,
  type SessionManager,
  type SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { CODEMODE_TOOL } from "../shared/codemode.ts";

type Credentials = NonNullable<
  Parameters<typeof ModelRuntime.create>[0]
>["credentials"];

// ponytail: pi doesn't export it, so it's loaded by path; recheck on pi upgrades.
const loader = (await import(
  new URL(
    "./core/extensions/loader.js",
    import.meta.resolve("@earendil-works/pi-coding-agent"),
  ).href
)) as { clearExtensionCache(): void };

/**
 * Forgets loaded extension modules, so the next load evaluates them afresh:
 * pi reuses them for the same folder, and pi-claude-bridge keeps each
 * conversation's state at module level.
 */
export function freshExtensions() {
  loader.clearExtensionCache();
}

/** pi's built-in tools; its grep/find/ls (ripgrep, fd) skip ignored files. */
export const defaultTools = [
  "read",
  "bash",
  "edit",
  "write",
  "grep",
  "find",
  "ls",
];

/** A conversation's: the built-ins, and codemode (subagents don't get it). */
export const conversationTools = [...defaultTools, CODEMODE_TOOL];

type Tools = Pick<
  AgentSession,
  | "getActiveToolNames"
  | "getAllTools"
  | "getToolDefinition"
  | "setActiveToolsByName"
>;

/**
 * Activates what pi left out reopening a conversation with only the tools its
 * transcript last declared: the default tools, and extension tools that would
 * be active on registration (web_search after signing in, a new MCP server's,
 * an update's). Our extensions still switch their own before each run.
 */
export function activateCurrentTools(session: Tools, tools = defaultTools) {
  const active = session.getActiveToolNames();
  const missing = session.getAllTools().filter((tool) => {
    if (active.includes(tool.name)) return false;
    if (tools.includes(tool.name)) return true;
    if (tool.sourceInfo.path.startsWith("builtin:")) return false;
    const declared =
      tool.exposure === "direct" || tool.exposure === "model-only";
    return (
      declared && session.getToolDefinition(tool.name)?.defaultActive !== false
    );
  });
  if (missing.length)
    session.setActiveToolsByName([...active, ...missing.map((t) => t.name)]);
}

// Every session registers its own pi-claude-bridge; in one shared runtime the
// last registration would take every session's Claude calls.
/**
 * A model runtime for one session in `cwd`, which it passes to providers:
 * pi-claude-bridge runs Claude Code in `options.cwd`, which pi never sets.
 * `keys` copies runtime keys in (a conversation's fallback key, for its subagent).
 */
export async function runtimeFor(
  credentials: Credentials,
  cwd: string,
  keys?: { copyTo(runtime: ModelRuntime): Promise<void> },
) {
  const runtime = await ModelRuntime.create({ credentials, modelsPath: null });
  await keys?.copyTo(runtime);
  const stream = runtime.stream.bind(runtime);
  const streamSimple = runtime.streamSimple.bind(runtime);
  runtime.stream = (model, context, options) =>
    stream(model, context, { ...options, cwd } as unknown as typeof options);
  runtime.streamSimple = (model, context, options) =>
    streamSimple(model, context, {
      ...options,
      cwd,
    } as unknown as typeof options);
  return runtime;
}

const MODEL_WAIT_MS = 10_000;

function sameModel(
  a: { provider: string; id: string } | undefined,
  b: { provider: string; id: string },
): boolean {
  return !!a && a.provider === b.provider && a.id === b.id;
}

// Read before createAgentSession, which saves its own fallback into an empty
// session and would hide this choice.
/** The model the session last used, else the default for new sessions. */
export function savedModel(
  sessionManager: SessionManager,
  settingsManager: SettingsManager,
) {
  const saved = sessionManager.buildSessionContext().model;
  const provider = saved?.provider ?? settingsManager.getDefaultProvider();
  const id = saved?.modelId ?? settingsManager.getDefaultModel();
  return provider && id ? { provider, id } : undefined;
}

async function whenAvailable(
  runtime: ModelRuntime,
  provider: string,
  id: string,
) {
  const deadline = Date.now() + MODEL_WAIT_MS;
  for (;;) {
    const model = runtime.getModel(provider, id);
    if (model && (await runtime.checkAuth(provider))) return model;
    if (Date.now() >= deadline) return undefined;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

// pi picks the model before extensions register their providers, so a saved
// claude-bridge model isn't found yet; wait for it, then pick it again.
/** Returns a warning when the saved model never became available. */
export async function reselectModel(
  wanted: { provider: string; id: string } | undefined,
  session: AgentSession,
): Promise<string | undefined> {
  if (!wanted || sameModel(session.model, wanted)) return;
  const model = await whenAvailable(
    session.modelRuntime,
    wanted.provider,
    wanted.id,
  );
  if (model) {
    await session.setModel(model);
    return;
  }
  const using = session.model ? `; using ${session.model.name}` : "";
  return `${wanted.id} isn't available${using}.`;
}
