import {
  type AgentSession,
  ModelRuntime,
  type SessionManager,
  type SettingsManager,
} from "@earendil-works/pi-coding-agent";

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

// Every session registers its own pi-claude-bridge; in one shared runtime the
// last registration would take every session's Claude calls.
/**
 * A model runtime for one session in `cwd`, which it passes to providers:
 * pi-claude-bridge runs Claude Code in `options.cwd`, which pi never sets.
 */
export async function runtimeFor(credentials: Credentials, cwd: string) {
  const runtime = await ModelRuntime.create({ credentials, modelsPath: null });
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
