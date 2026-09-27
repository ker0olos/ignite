import { Fragment, useState, type ComponentType } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  KeyRound,
  Loader2,
} from "lucide-react";
import {
  apiKeyProblem,
  type AuthMethod,
  type ProviderId,
  type ProviderStatus,
} from "../../shared/hostProtocol";
import { ClaudeLogo, OpenAILogo } from "@/components/ProviderLogos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { LoginState, useProviders } from "@/hooks/useProviders";
import { claudeSignIn } from "@/lib/providerGroups";
import { cn } from "@/lib/utils";

type Providers = ReturnType<typeof useProviders>;

type Option = {
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

type Card = {
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

function ProviderCard({
  card,
  providers,
  loading,
}: {
  card: Card;
  providers: Providers;
  loading: boolean;
}) {
  const { statuses, login, error, connect, disconnect } = providers;
  const [keyFor, setKeyFor] = useState<Option | null>(null);
  const status = (id: ProviderId) => statuses?.find((s) => s.id === id);
  // Signed in through Claude Code or the Codex CLI rather than the app.
  const borrowed = (o: Option) =>
    o.provider === "claude-code" || !!status(o.provider)?.viaCodex;

  const ids = card.options.map((o) => o.provider);
  const connected = card.options.filter(
    (o) =>
      status(o.provider)?.connected && status(o.provider)?.method === o.method,
  );
  // Each card is one choice: once either way is connected, the other is hidden.
  const available = connected.length
    ? []
    : card.options.filter((o) => o.offered?.(statuses) ?? true);
  const activeLogin = login && ids.includes(login.provider) ? login : null;
  const cardError = error && ids.includes(error.provider) ? error : null;
  const Icon = card.icon;

  return (
    <section className="flex flex-col rounded-xl border bg-card p-5">
      <header className="flex items-center gap-3">
        <Icon className="size-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold leading-tight">
            {card.title}
          </h2>
          <p className="text-xs text-muted-foreground">{card.maker}</p>
        </div>
        <StatusPill connected={connected.length > 0} loading={loading} />
      </header>

      <div className="mt-5 flex flex-1 flex-col gap-2">
        {connected.map((option) => (
          <div
            key={option.provider}
            className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5"
          >
            <Check className="size-4 shrink-0 text-success" />
            <span className="min-w-0 flex-1 text-[13px]">
              {borrowed(option)
                ? (option.borrowedLabel ?? option.connectedLabel)
                : option.connectedLabel}
            </span>
            {/* Signing out here would sign the user out of that tool too. */}
            {!borrowed(option) && (
              <DisconnectButton
                title={card.title}
                disabled={!!login}
                onConfirm={() => disconnect(option.provider)}
              />
            )}
          </div>
        ))}

        {activeLogin ? (
          <LoginPanel login={activeLogin} onCancel={providers.cancel} />
        ) : keyFor ? (
          <KeyForm
            option={keyFor}
            onCancel={() => setKeyFor(null)}
            onSave={async (key) => {
              if (await connect(keyFor.provider, "api_key", key)) {
                setKeyFor(null);
              }
            }}
          />
        ) : (
          available.map((option, i) => (
            <Fragment key={`${option.provider}-${option.method}`}>
              {i > 0 && <OrDivider />}
              <OptionRow
                option={option}
                disabled={loading || !!login}
                onClick={() =>
                  option.method === "api_key"
                    ? setKeyFor(option)
                    : void connect(option.provider, option.method)
                }
              />
            </Fragment>
          ))
        )}

        {cardError && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {cardError.message}
          </p>
        )}
      </div>
    </section>
  );
}

function DisconnectButton({
  title,
  disabled,
  onConfirm,
}: {
  title: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="destructive" size="sm" disabled={disabled} />}
      >
        Disconnect
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Disconnect {title}?</DialogTitle>
          <DialogDescription>
            Its saved credentials are removed from this Mac. You can connect
            again anytime.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <DialogClose
            render={<Button variant="destructive" />}
            onClick={onConfirm}
          >
            Disconnect
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Separates alternatives: a provider takes a subscription or a key, not both. */
function OrDivider() {
  return (
    <div className="flex items-center gap-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function StatusPill({
  connected,
  loading,
}: {
  connected: boolean;
  loading: boolean;
}) {
  if (loading) {
    return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  }
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-[11px] font-medium",
        connected ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          connected ? "bg-success" : "bg-muted-foreground/40",
        )}
      />
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

function OptionRow({
  option,
  disabled,
  onClick,
}: {
  option: Option;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = option.method === "api_key" ? KeyRound : ArrowRight;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-left transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{option.label}</span>
        <span className="block text-xs text-muted-foreground">
          {option.hint}
        </span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

/** A running sign-in: what's happening, and a way out. */
function LoginPanel({
  login,
  onCancel,
}: {
  login: LoginState;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        {login.progress ??
          (login.method === "api_key"
            ? "Saving your key…"
            : "Waiting for you to sign in…")}
      </div>

      <div className="mt-3 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function KeyForm({
  option,
  onSave,
  onCancel,
}: {
  option: Option;
  onSave: (key: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [key, setKey] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <form
      className="rounded-lg border bg-background p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const found = apiKeyProblem(key);
        setProblem(found);
        if (!found) void onSave(key.trim());
      }}
    >
      <label className="text-[13px] font-medium">{option.label}</label>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Stored only on this Mac. You can remove it anytime.
      </p>
      <input
        type="password"
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          setProblem(null);
        }}
        placeholder={option.keyPlaceholder}
        spellCheck={false}
        autoFocus
        className="mt-3 h-8 w-full rounded-md border bg-background px-2.5 font-mono text-[13px] select-text"
      />
      {problem && <p className="mt-1.5 text-xs text-destructive">{problem}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Save key
        </Button>
      </div>
    </form>
  );
}
