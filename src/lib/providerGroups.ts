import type { ProviderId, ProviderStatus } from "../../shared/hostProtocol";

/**
 * How providers are presented: one entry per brand, connected either with a
 * subscription or an API key. Several pi providers can sit behind one brand
 * (ChatGPT sign-in is openai-codex, its API key is openai); users should only
 * ever see the brand.
 */
export type ProviderGroup = {
  name: string;
  /** Subscription sign-ins, preferred first. */
  subscription: ProviderId[];
  apiKey: ProviderId;
  /** pi providers whose models belong to this brand. */
  modelProviders: string[];
};

export const PROVIDER_GROUPS: ProviderGroup[] = [
  {
    name: "Claude",
    // pi's own Claude sign-in bills extra usage; Claude Code's bills the plan.
    subscription: ["claude-code", "anthropic"],
    apiKey: "anthropic",
    modelProviders: ["claude-bridge", "anthropic"],
  },
  {
    name: "ChatGPT",
    subscription: ["openai-codex"],
    apiKey: "openai",
    modelProviders: ["openai-codex", "openai"],
  },
];

/** How a group is connected, or null if it isn't. A subscription wins if both are. */
export function groupConnection(
  group: ProviderGroup,
  statuses: ProviderStatus[],
): "subscription" | "api_key" | null {
  const status = (id: ProviderId, method: string) =>
    statuses.some((s) => s.id === id && s.connected && s.method === method);
  if (group.subscription.some((id) => status(id, "oauth"))) {
    return "subscription";
  }
  if (status(group.apiKey, "api_key")) return "api_key";
  return null;
}

/**
 * Which Claude sign-in to offer: Claude Code's when it's installed, since
 * that one uses the plan's limits; otherwise pi's own.
 */
export function claudeSignIn(statuses: ProviderStatus[] | null): ProviderId {
  return statuses?.some((s) => s.id === "claude-code" && s.installed)
    ? "claude-code"
    : "anthropic";
}

/** The brand a pi provider belongs to, or the provider id if it has none. */
export function providerName(provider: string): string {
  return (
    PROVIDER_GROUPS.find((g) => g.modelProviders.includes(provider))?.name ??
    provider
  );
}
