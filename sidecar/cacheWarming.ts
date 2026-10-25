import { SettingsManager } from "@earendil-works/pi-coding-agent";

/**
 * Has pi keep prompt caches warm between runs too (`cacheWarming: "idle"`),
 * unless pi's settings already say otherwise. pi reads it from its global
 * settings only, so it's saved there. Only models that declare a cache
 * lifetime warm (the fallback keys' Anthropic models, not claude-bridge),
 * and only when pi estimates the refresh saves $0.05 or more.
 */
export async function warmCachesWhenIdle(agentDir: string) {
  const settings = SettingsManager.create(agentDir, agentDir);
  if (settings.getGlobalSettings().cacheWarming !== undefined) return;
  settings.setCacheWarmingMode("idle");
  await settings.flush();
}
