import type { HostContext } from "./hostTypes.ts";

/**
 * Saves whether the folder is trusted. Trusting an open folder reloads its
 * session with the folder's own pi resources, after the current run.
 */
export async function setTrust(
  ctx: HostContext,
  cwd: string,
  trusted: boolean,
) {
  ctx.trust.set(cwd, trusted);
  const project = ctx.projects.get(cwd);
  const s = project?.session;
  if (!trusted || !project || !s) return undefined;
  s.settingsManager.setProjectTrusted(true);
  if (s.isStreaming) project.reloadWhenSettled = true;
  else await s.reload();
  return undefined;
}
