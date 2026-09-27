import { useCallback, useEffect, useState } from "react";
import type {
  ModelInfo,
  OpenedSession,
  ProjectTrust,
  ProviderStatus,
  SessionState,
  ThinkingLevel,
} from "../../shared/hostProtocol";
import type { ImageContent } from "../../shared/agentTypes";
import type { HostClient } from "@/lib/piHost";
import { useSessionEvents } from "@/hooks/useSessionEvents";
import { fromHistory, type Transcript } from "@/lib/transcript";

type Opened = {
  host: HostClient;
  folder: string;
  state: SessionState;
  trust: ProjectTrust;
  transcript: Transcript;
};

const toOpened = (
  host: HostClient,
  folder: string,
  { messages, running, trust, ...state }: OpenedSession,
): Opened => ({
  host,
  folder,
  state,
  trust,
  transcript: fromHistory(messages, running),
});

/** What the app sees of the session; every field is null until it's open. */
const view = (s: Opened | null) => ({
  state: s?.state ?? null,
  /** The conversation. */
  transcript: s?.transcript ?? null,
  /** Whether the folder's own pi resources load. */
  trust: s?.trust ?? null,
});

/**
 * The pi session for the open folder: the conversation, sending and stopping,
 * approving tool calls, the folder's trust, and its model and effort with the
 * choices pi offers for them. The settings refresh when providers connect or
 * disconnect, since that changes which models are available.
 */
export function useAgentSession(
  host: HostClient | null,
  folder: string | null,
  statuses: ProviderStatus[] | null,
) {
  // Tagged with what it was opened for, so a stale session never shows.
  const [session, setSession] = useState<Opened | null>(null);
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
  const update = useCallback(
    (f: (t: Transcript) => Transcript) =>
      setSession((s) => s && { ...s, transcript: f(s.transcript) }),
    [],
  );

  useEffect(() => {
    if (!host || !folder) return;
    let live = true;
    host
      .request({ type: "open_session", cwd: folder })
      .then((s) => live && setSession(toOpened(host, folder, s)))
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

  const answer = useSessionEvents(opened, update, setError);

  const setTrust = useCallback(
    async (trusted: boolean) => {
      if (!opened || !folder) return;
      const trust = trusted ? "trusted" : "untrusted";
      setSession((s) => s && { ...s, trust });
      await opened
        .request({ type: "set_trust", cwd: folder, trusted })
        .catch((e: Error) => setError(e.message));
    },
    [opened, folder],
  );

  const send = useCallback(
    async (text: string, images: ImageContent[] = []) => {
      if (!opened || (!text.trim() && !images.length)) return;
      setError(null);
      try {
        await opened.request({
          type: "prompt",
          text,
          ...(images.length > 0 && { images }),
        });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [opened],
  );

  const clear = useCallback(async () => {
    if (!opened || !folder) return;
    setError(null);
    try {
      const s = await opened.request({ type: "clear_session" });
      setSession(toOpened(opened, folder, s));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [opened, folder]);

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
    ...view(current),
    error,
    send,
    stop,
    /** Deletes the folder's saved conversations and starts an empty one. */
    clear,
    /** Approves or denies a tool call that waits for the user. */
    answer,
    setTrust,
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
