import type { HostContext } from "./hostTypes.ts";

/**
 * Saves whether the folder is trusted. Trusting an open folder reloads its
 * sessions with the folder's own pi resources, each after its current run.
 */
export async function setTrust(
  ctx: HostContext,
  cwd: string,
  trusted: boolean,
) {
  ctx.trust.set(cwd, trusted);
  if (!trusted) return undefined;
  for (const agent of ctx.agents.values()) {
    const s = agent.session;
    if (agent.cwd !== cwd || !s) continue;
    s.settingsManager.setProjectTrusted(true);
    if (s.isStreaming) agent.reloadWhenSettled = true;
    else await s.reload();
  }
  return undefined;
}
