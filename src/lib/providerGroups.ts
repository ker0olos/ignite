import type { ProviderId, ProviderStatus } from "../../shared/hostProtocol";

/**
 * How providers are presented: one entry per brand, connected either with a
 * subscription or an API key. For ChatGPT these are two pi providers
 * (openai-codex and openai); users should only ever see the brand.
 */
export type ProviderGroup = {
  name: string;
  subscription: ProviderId;
  apiKey: ProviderId;
};

export const PROVIDER_GROUPS: ProviderGroup[] = [
  { name: "Claude", subscription: "anthropic", apiKey: "anthropic" },
  { name: "ChatGPT", subscription: "openai-codex", apiKey: "openai" },
];

/** How a group is connected, or null if it isn't. A subscription wins if both are. */
export function groupConnection(
  group: ProviderGroup,
  statuses: ProviderStatus[],
): "subscription" | "api_key" | null {
  const status = (id: ProviderId, method: string) =>
    statuses.some((s) => s.id === id && s.connected && s.method === method);
  if (status(group.subscription, "oauth")) return "subscription";
  if (status(group.apiKey, "api_key")) return "api_key";
  return null;
}
