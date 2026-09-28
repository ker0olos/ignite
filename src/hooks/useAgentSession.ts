import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  applyError,
  fromHistory,
  requestApproval,
  type Transcript,
} from "@/lib/transcript";

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
  {
    messages,
    running,
    trust,
    modelWarning,
    approvals,
    ...state
  }: OpenedSession,
): Opened => {
  const transcript = approvals.reduce(
    requestApproval,
    fromHistory(messages, running),
  );
  return {
    host,
    folder,
    state,
    trust,
    transcript: modelWarning
      ? applyError(transcript, modelWarning)
      : transcript,
  };
};

/** What the app sees of the session; every field is null until it's open. */
const view = (s: Opened | null) => ({
  state: s?.state ?? null,
  /** The conversation. */
  transcript: s?.transcript ?? null,
  /** Whether the folder's own pi resources load. */
  trust: s?.trust ?? null,
  /** The session's host, for requests outside the conversation (e.g. a diff). */
  host: s?.host ?? null,
});

/**
 * Every open folder's last known session, so switching back shows it at once;
 * each is tagged with its host, so a stale one never shows.
 */
function useSessionCache(host: HostClient | null, folder: string | null) {
  const [sessions, setSessions] = useState<Record<string, Opened>>({});
  // Events only apply once the sidecar has answered for this folder.
  const synced = useRef<string | null>(null);
  const cached = folder ? sessions[folder] : undefined;
  const current = cached?.host === host ? cached : null;
  const opened = current?.host ?? null;
  const put = useCallback(
    (o: Opened) => setSessions((all) => ({ ...all, [o.folder]: o })),
    [],
  );
  const patch = useCallback(
    (f: (o: Opened) => Opened) =>
      setSessions((all) => {
        const o = folder ? all[folder] : undefined;
        return o ? { ...all, [o.folder]: f(o) } : all;
      }),
    [folder],
  );
  const setState = useCallback(
    (state: SessionState) => patch((o) => ({ ...o, state })),
    [patch],
  );
  const update = useCallback(
    (f: (t: Transcript) => Transcript) => {
      if (synced.current !== folder) return;
      patch((o) => ({ ...o, transcript: f(o.transcript) }));
    },
    [patch, folder],
  );

  return { current, opened, synced, put, patch, setState, update };
}

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
  const { current, opened, synced, put, patch, setState, update } =
    useSessionCache(host, folder);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!host || !folder) return;
    let live = true;
    host
      .request({ type: "open_session", cwd: folder })
      .then((s) => {
        if (!live) return;
        synced.current = folder;
        put(toOpened(host, folder, s));
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
      synced.current = null;
      // An error belongs to the folder it happened in.
      setError(null);
    };
  }, [host, folder, put, synced]);

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
      patch((o) => ({ ...o, trust }));
      await opened
        .request({ type: "set_trust", cwd: folder, trusted })
        .catch((e: Error) => setError(e.message));
    },
    [opened, folder, patch],
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
      put(toOpened(opened, folder, s));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [opened, folder, put]);

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
