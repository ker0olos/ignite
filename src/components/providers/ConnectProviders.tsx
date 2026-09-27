import type { ComponentType } from "react";
import { ArrowRight } from "lucide-react";
import type {
  AuthMethod,
  ProviderId,
  ProviderStatus,
} from "../../../shared/hostProtocol";
import { ClaudeLogo } from "@/components/providers/ClaudeLogo";
import { OpenAILogo } from "@/components/providers/OpenAILogo";
import { ProviderCard } from "@/components/providers/ProviderCard";
import { Button } from "@/components/ui/button";
import type { useProviders } from "@/hooks/useProviders";
import { claudeSignIn } from "@/lib/providerGroups";

export type Providers = ReturnType<typeof useProviders>;

export type Option = {
  provider: ProviderId;
  method: AuthMethod;
  label: string;
  hint: string;
  connectedLabel: string;
  keyPlaceholder?: string;
  /** Shown instead when it's signed in with another tool's login. */
  borrowedLabel?: string;
  /** Whether to offer this option, given every provider's status. */
  offered?: (statuses: ProviderStatus[] | null) => boolean;
};

export type Card = {
  title: string;
  maker: string;
  icon: ComponentType<{ className?: string }>;
  options: Option[];
};

const CARDS: Card[] = [
  {
    title: "Claude",
    maker: "Anthropic",
    icon: ClaudeLogo,
    options: [
      {
        provider: "claude-code",
        method: "oauth",
        label: "Sign in with Claude",
        hint: "Uses your Claude Code sign-in",
        connectedLabel: "Using your Claude Code sign-in",
        offered: (s) => claudeSignIn(s) === "claude-code",
      },
      {
        provider: "anthropic",
        method: "oauth",
        label: "Sign in with Claude",
        hint: "",
        connectedLabel: "Signed in to your Claude",
        offered: (s) => claudeSignIn(s) === "anthropic",
      },
      {
        provider: "anthropic",
        method: "api_key",
        label: "Use an Anthropic API key",
        hint: "Pay per token",
        connectedLabel: "Using an Anthropic API key",
        keyPlaceholder: "sk-ant-…",
      },
    ],
  },
  {
    title: "ChatGPT",
    maker: "OpenAI",
    icon: OpenAILogo,
    options: [
      {
        provider: "openai-codex",
        method: "oauth",
        label: "Sign in with ChatGPT",
        hint: "",
        connectedLabel: "Signed in to your ChatGPT",
        borrowedLabel: "Using your Codex sign-in",
      },
      {
        provider: "openai",
        method: "api_key",
        label: "Use an OpenAI API key",
        hint: "Pay per token",
        connectedLabel: "Using an OpenAI API key",
        keyPlaceholder: "sk-…",
      },
    ],
  },
];

/**
 * Full-window screen for connecting model providers: a subscription sign-in
 * or an API key per provider. Shown on first launch and from Settings.
 */
export function ConnectProviders({
  providers,
  onDone,
}: {
  providers: Providers;
  onDone: () => void;
}) {
  const { statuses, hostError, anyConnected } = providers;

  return (
    <div className="flex h-screen flex-col">
      <div data-tauri-drag-region className="h-13 shrink-0" />
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="always-bounce flex justify-center px-8 pt-6 pb-16">
          <div className="w-full max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-tight">
              Connect a model provider
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              Sign in with a subscription or add an API key.
            </p>

            {hostError ? (
              <p className="mt-8 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-[13px]">
                Couldn't start the agent host: {hostError}. It needs Node.js
                22.19 or newer on your PATH.
              </p>
            ) : (
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {CARDS.map((card) => (
                  <ProviderCard
                    key={card.title}
                    card={card}
                    providers={providers}
                    loading={!statuses}
                  />
                ))}
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <Button
                variant={anyConnected ? "default" : "outline"}
                onClick={onDone}
              >
                {anyConnected ? "Continue" : "Skip for now"}
                {anyConnected && <ArrowRight />}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
