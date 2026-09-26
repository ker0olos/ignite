import { useCallback, useEffect, useState } from "react";
import type {
  ModelInfo,
  ProviderStatus,
  SessionState,
  ThinkingLevel,
} from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import {
  applyError,
  applyEvent,
  fromHistory,
  type Transcript,
} from "@/lib/transcript";

/**
 * The pi session for the open folder: the conversation, sending and stopping,
 * and its model and effort with the choices pi offers for them. The settings
 * refresh when providers connect or disconnect, since that changes which
 * models are available.
 */
export function useAgentSession(
  host: HostClient | null,
  folder: string | null,
  statuses: ProviderStatus[] | null,
) {
  // Tagged with what it was opened for, so a stale session never shows.
  const [session, setSession] = useState<{
    host: HostClient;
    folder: string;
    state: SessionState;
    transcript: Transcript;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current =
    session && session.host === host && session.folder === folder
      ? session
      : null;
  const opened = current?.host ?? null;
  const setState = useCallback(
    (state: SessionState) => setSession((s) => s && { ...s, state }),
    [],
  );

  useEffect(() => {
    if (!host || !folder) return;
    let live = true;
    host
      .request({ type: "open_session", cwd: folder })
      .then(
        ({ messages, running, ...state }) =>
          live &&
          setSession({
            host,
            folder,
            state,
            transcript: fromHistory(messages, running),
          }),
      )
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [host, folder]);

  useEffect(() => {
    if (!opened || !statuses) return;
    let live = true;
    opened
      .request({ type: "session_state" })
      .then((s) => live && setState(s))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [opened, statuses, setState]);

  useEffect(() => {
    if (!opened) return;
    const update = (f: (t: Transcript) => Transcript) =>
      setSession((s) => s && { ...s, transcript: f(s.transcript) });
    return opened.subscribe((message) => {
      if (message.type === "session_event") {
        update((t) => applyEvent(t, message.event));
      } else if (message.type === "session_error") {
        update((t) => applyError(t, message.error));
      }
    });
  }, [opened]);

  const send = useCallback(
    async (text: string) => {
      if (!opened || !text.trim()) return;
      setError(null);
      try {
        await opened.request({ type: "prompt", text });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [opened],
  );

  const stop = useCallback(async () => {
    await opened?.request({ type: "abort" }).catch(() => {});
  }, [opened]);

  const change = useCallback(
    async (
      request:
        | { type: "set_model"; provider: string; modelId: string }
        | { type: "set_thinking_level"; level: ThinkingLevel },
    ) => {
      if (!opened) return;
      setError(null);
      try {
        setState(await opened.request(request));
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [opened, setState],
  );

  return {
    /** Null until the session is open. */
    state: current?.state ?? null,
    /** The conversation; null until the session is open. */
    transcript: current?.transcript ?? null,
    error,
    send,
    stop,
    setModel: (model: ModelInfo) =>
      change({
        type: "set_model",
        provider: model.provider,
        modelId: model.id,
      }),
    setThinkingLevel: (level: ThinkingLevel) =>
      change({ type: "set_thinking_level", level }),
  };
}
