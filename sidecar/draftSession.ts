/**
 * What a new conversation would start with, before it exists: one in-memory
 * session that never runs anything and loads only the Claude bridge, so a
 * folder with no conversation can offer the models (Claude's included) and
 * effort levels. Choices are tried on it without becoming the defaults.
 */
import {
  type AgentSession,
  createAgentSession,
  createEventBus,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { ThinkingLevel } from "../shared/hostProtocol.ts";
import type { Session } from "./hostTypes.ts";
import { freshExtensions, runtimeFor } from "./sessionRuntime.ts";

/** A model and effort to show instead of the defaults. */
export type DraftPick = {
  model?: { provider: string; id: string };
  level?: ThinkingLevel;
};

type Deps = {
  agentDir: string;
  claudeBridge: string;
  credentials: Parameters<typeof runtimeFor>[0];
  uiContext: Parameters<AgentSession["bindExtensions"]>[0]["uiContext"];
};

async function openDraft({
  agentDir,
  claudeBridge,
  credentials,
  uiContext,
}: Deps) {
  const settingsManager = SettingsManager.inMemory();
  const resourceLoader = new DefaultResourceLoader({
    cwd: agentDir,
    agentDir,
    settingsManager,
    eventBus: createEventBus(),
    additionalExtensionPaths: [claudeBridge],
  });
  freshExtensions();
  await resourceLoader.reload();
  const { session } = await createAgentSession({
    cwd: agentDir,
    agentDir,
    modelRuntime: await runtimeFor(credentials, agentDir),
    sessionManager: SessionManager.inMemory(agentDir),
    settingsManager,
    resourceLoader,
  });
  await session.bindExtensions({ uiContext });
  return session;
}

// Read each time: a conversation saves the user's latest choice as the default.
async function show(
  s: AgentSession,
  { model, level }: DraftPick,
  agentDir: string,
) {
  const defaults = SettingsManager.create(agentDir, agentDir);
  const provider = model?.provider ?? defaults.getDefaultProvider();
  const id = model?.id ?? defaults.getDefaultModel();
  // The bridge registered its models while the draft opened.
  const found = provider && id && s.modelRuntime.getModel(provider, id);
  if (found) await s.setModel(found);
  const effort = level ?? defaults.getDefaultThinkingLevel();
  if (effort) s.setThinkingLevel(effort);
}

/** Returns the draft session showing `pick`, or else the saved defaults; opened on first use. */
export function createDraft(deps: Deps) {
  let draft: Promise<AgentSession> | undefined;
  return async (pick: DraftPick): Promise<Session> => {
    draft ??= openDraft(deps).catch((error: unknown) => {
      draft = undefined;
      throw error;
    });
    const s = await draft;
    await show(s, pick, deps.agentDir);
    return s as unknown as Session;
  };
}
