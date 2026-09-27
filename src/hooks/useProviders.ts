import { useCallback, useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type {
  AuthMethod,
  HostMessage,
  ProviderId,
  ProviderStatus,
} from "../../shared/hostProtocol";
import { reportHealthy } from "@/lib/health";
import { openPiHost, type HostClient } from "@/lib/piHost";

/** A sign-in in progress. */
export type LoginState = {
  provider: ProviderId;
  method: AuthMethod;
  /** Latest progress message from the provider, if any. */
  progress?: string;
};

const CANCELLED = "Sign-in cancelled.";

/**
 * Provider connections, through the pi host sidecar: status per provider,
 * one sign-in at a time, and disconnecting. `open` starts the sidecar; tests
 * pass a fake.
 */
export function useProviders(open: () => Promise<HostClient> = openPiHost) {
  const [statuses, setStatuses] = useState<ProviderStatus[] | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);
  const [login, setLogin] = useState<LoginState | null>(null);
  const [error, setError] = useState<{
    provider: ProviderId;
    message: string;
  } | null>(null);
  const client = useRef<HostClient | null>(null);
  const [host, setHost] = useState<HostClient | null>(null);

  const updateStatus = (status: ProviderStatus) =>
    setStatuses(
      (all) => all?.map((s) => (s.id === status.id ? status : s)) ?? [status],
    );

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    let started: HostClient | null = null;

    // Sign-ins run in the browser (the sidecar always picks it), so the only
    // things to act on are opening that page and showing progress. pi's
    // paste-a-code prompt is left unanswered; the browser callback completes
    // the sign-in without it.
    const onMessage = (message: HostMessage) => {
      if (message.type !== "auth_event") return;
      const { event } = message;
      if (event.type === "auth_url") {
        openUrl(event.url).catch(() => {});
      } else if (event.type === "progress" || event.type === "info") {
        setLogin((l) => l && { ...l, progress: event.message });
      }
    };

    open()
      .then(async (c) => {
        started = c;
        if (cancelled) return void c.close();
        client.current = c;
        setHost(c);
        unsubscribe = c.subscribe(onMessage);
        setStatuses(await c.request({ type: "status" }));
        void reportHealthy();
      })
      .catch((e: Error) => !cancelled && setHostError(e.message));

    return () => {
      cancelled = true;
      unsubscribe();
      client.current = null;
      void started?.close();
    };
  }, [open]);

  /** Signs in; resolves true on success. Errors land in `error`, cancels don't. */
  const connect = useCallback(
    async (provider: ProviderId, method: AuthMethod, apiKey?: string) => {
      const c = client.current;
      if (!c) return false;
      setError(null);
      setLogin({ provider, method });
      try {
        updateStatus(
          await c.request({ type: "login", provider, method, apiKey }),
        );
        return true;
      } catch (e) {
        const message = (e as Error).message;
        if (message !== CANCELLED) setError({ provider, message });
        return false;
      } finally {
        setLogin(null);
      }
    },
    [],
  );

  const cancel = useCallback(async () => {
    await client.current?.request({ type: "cancel_login" });
  }, []);

  const disconnect = useCallback(async (provider: ProviderId) => {
    const c = client.current;
    if (!c) return;
    setError(null);
    try {
      updateStatus(await c.request({ type: "logout", provider }));
    } catch (e) {
      setError({ provider, message: (e as Error).message });
    }
  }, []);

  return {
    /** The sidecar, once started; shared with the agent session. */
    host,
    /** Null until the sidecar has answered. */
    statuses,
    /** Set when the sidecar couldn't start; nothing else works then. */
    hostError,
    login,
    error,
    anyConnected: statuses?.some((s) => s.connected) ?? false,
    connect,
    cancel,
    disconnect,
  };
}
