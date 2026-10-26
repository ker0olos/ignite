import { SettingsManager } from "@earendil-works/pi-coding-agent";

/** Saves pi's `cacheWarming: "idle"` (read from its global settings only) unless they already choose. */
export async function warmCachesWhenIdle(agentDir: string) {
  const settings = SettingsManager.create(agentDir, agentDir);
  if (settings.getGlobalSettings().cacheWarming !== undefined) return;
  settings.setCacheWarmingMode("idle");
  await settings.flush();
}
