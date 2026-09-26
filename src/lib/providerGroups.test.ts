import { describe, expect, it } from "vitest";
import type { ProviderStatus } from "../../shared/hostProtocol";
import { PROVIDER_GROUPS, groupConnection } from "./providerGroups";

const [claude, chatgpt] = PROVIDER_GROUPS;
const off: ProviderStatus[] = [
  { id: "anthropic", connected: false },
  { id: "openai-codex", connected: false },
  { id: "openai", connected: false },
];
const withStatus = (...on: ProviderStatus[]) =>
  off.map((s) => on.find((o) => o.id === s.id) ?? s);

describe("groupConnection", () => {
  it("is null when nothing in the group is connected", () => {
    expect(groupConnection(claude, off)).toBeNull();
    expect(groupConnection(chatgpt, off)).toBeNull();
  });

  it("reports a Claude subscription and a Claude API key", () => {
    expect(
      groupConnection(
        claude,
        withStatus({ id: "anthropic", connected: true, method: "oauth" }),
      ),
    ).toBe("subscription");
    expect(
      groupConnection(
        claude,
        withStatus({ id: "anthropic", connected: true, method: "api_key" }),
      ),
    ).toBe("api_key");
  });

  it("treats ChatGPT sign-in and an OpenAI key as one group", () => {
    expect(
      groupConnection(
        chatgpt,
        withStatus({ id: "openai-codex", connected: true, method: "oauth" }),
      ),
    ).toBe("subscription");
    expect(
      groupConnection(
        chatgpt,
        withStatus({ id: "openai", connected: true, method: "api_key" }),
      ),
    ).toBe("api_key");
  });

  it("prefers the subscription when both are connected", () => {
    expect(
      groupConnection(
        chatgpt,
        withStatus(
          { id: "openai-codex", connected: true, method: "oauth" },
          { id: "openai", connected: true, method: "api_key" },
        ),
      ),
    ).toBe("subscription");
  });

  it("doesn't count one group's connection for another", () => {
    expect(
      groupConnection(
        chatgpt,
        withStatus({ id: "anthropic", connected: true, method: "oauth" }),
      ),
    ).toBeNull();
  });
});
