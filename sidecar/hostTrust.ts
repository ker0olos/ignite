import { reload, type HostContext } from "./hostTypes.ts";

/**
 * Saves whether the folder is trusted. Trusting an open folder reloads its
 * sessions with the folder's own pi resources, each after its current run.
 */
export async function setTrust(
  ctx: HostContext,
  cwd: string,
  trusted: boolean,
) {
  // What the user trusts: the folder's .pi/ and its open conversations' as they are now.
  const open = [...ctx.agents.values()].filter((a) => a.cwd === cwd);
  ctx.trust.set(cwd, trusted, [cwd, ...open.map((a) => a.workdir)]);
  if (!trusted) return undefined;
  for (const agent of open) {
    const s = agent.session;
    if (!s) continue;
    s.settingsManager.setProjectTrusted(true);
    if (s.isStreaming) agent.reloadWhenSettled = true;
    else await reload(agent, ctx.trust);
  }
  return undefined;
}
