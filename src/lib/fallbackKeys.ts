/** Whether a card shows fallback keys: it allows them and a subscription is connected. */
export function offersFallbackKeys(
  card: { fallbackKeys?: boolean },
  connected: { method: string }[],
): boolean {
  return !!card.fallbackKeys && connected.some((o) => o.method === "oauth");
}
