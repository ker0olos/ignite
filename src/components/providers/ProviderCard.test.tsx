import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProviderStatus } from "../../../shared/hostProtocol";
import { ClaudeLogo } from "@/components/providers/ClaudeLogo";
import type { Card, Providers } from "@/components/providers/ConnectProviders";
import { ProviderCard } from "@/components/providers/ProviderCard";
import type { useFallbackKeys } from "@/hooks/useFallbackKeys";

vi.mock("@/lib/lifecycle", () => ({ confirmNative: vi.fn() }));

const card: Card = {
  title: "Claude",
  maker: "Anthropic",
  icon: ClaudeLogo,
  fallbackKeys: true,
  options: [
    {
      provider: "anthropic",
      method: "oauth",
      label: "Sign in with Claude",
      hint: "",
      connectedLabel: "Signed in to your Claude",
    },
    {
      provider: "anthropic",
      method: "api_key",
      label: "Use an Anthropic API key",
      hint: "Pay per token",
      connectedLabel: "Using an Anthropic API key",
    },
  ],
};

function show(statuses: ProviderStatus[]) {
  const providers = {
    statuses,
    login: null,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    cancel: vi.fn(),
  } as unknown as Providers;
  const fallback = {
    keys: [{ id: "a", hint: "abcd" }],
    error: null,
    add: vi.fn(),
    remove: vi.fn(),
    move: vi.fn(),
  } as unknown as ReturnType<typeof useFallbackKeys>;
  render(
    <ProviderCard
      card={card}
      providers={providers}
      fallback={fallback}
      loading={false}
    />,
  );
}

describe("ProviderCard fallback keys", () => {
  it("shows them with a subscription connected", () => {
    show([{ id: "anthropic", connected: true, method: "oauth" }]);
    expect(screen.getByText("Fallback API keys")).toBeTruthy();
    expect(screen.getByText("Anthropic API key ••••abcd")).toBeTruthy();
  });

  it("hides them with an API key connected", () => {
    show([{ id: "anthropic", connected: true, method: "api_key" }]);
    expect(screen.queryByText("Fallback API keys")).toBeNull();
  });

  it("hides them with nothing connected", () => {
    show([{ id: "anthropic", connected: false }]);
    expect(screen.queryByText("Fallback API keys")).toBeNull();
  });
});
