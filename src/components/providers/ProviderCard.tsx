import { Fragment, useState } from "react";
import { Check } from "lucide-react";
import type {
  Card,
  Option,
  Providers,
} from "@/components/providers/ConnectProviders";
import { DisconnectButton } from "@/components/providers/DisconnectButton";
import { KeyForm } from "@/components/providers/KeyForm";
import { LoginPanel } from "@/components/providers/LoginPanel";
import { OptionRow } from "@/components/providers/OptionRow";
import { OrDivider } from "@/components/providers/OrDivider";
import { StatusPill } from "@/components/providers/StatusPill";
import type { ProviderId } from "../../../shared/hostProtocol";

/** One provider's card: connected accounts, and the ways left to connect. */
export function ProviderCard({
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
