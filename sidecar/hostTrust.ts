import type { HostContext } from "./hostTypes.ts";

/**
 * Saves whether the folder is trusted. Trusting the open folder reloads its
 * session with the folder's own pi resources, after the current run.
 */
export async function setTrust(
  ctx: HostContext,
  cwd: string,
  trusted: boolean,
) {
  ctx.trust.set(cwd, trusted);
  const s = ctx.session;
  if (!trusted || !s || ctx.cwd !== cwd) return undefined;
  s.settingsManager.setProjectTrusted(true);
  if (s.isStreaming) ctx.reloadWhenSettled = true;
  else await s.reload();
  return undefined;
}
