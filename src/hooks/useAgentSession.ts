import { useCallback, useEffect, useRef, useState } from "react";
import type { OpenedSession, ProviderStatus } from "../../shared/hostProtocol";
import type { HostClient } from "@/lib/piHost";
import { useComposerActions } from "@/hooks/useComposerActions";
import { useDraftState } from "@/hooks/useDraftState";
import { useForkWait } from "@/hooks/useForkWait";
import type { AgentMessage } from "../../shared/agentTypes";
import {
  toEntry,
  toStarting,
  useSessionCache,
  view,
} from "@/hooks/useSessionCache";
import { useSessionEvents } from "@/hooks/useSessionEvents";
import { useSessionSwitch } from "@/hooks/useSessionSwitch";

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
  const { current, opened, shownRef, synced, put, patch, setState, update } =
    useSessionCache(host, folder);
  const [error, setError] = useState<string | null>(null);
  // What a folder about to be selected shows instead of its last conversation:
  // a new one, or the one picked in the sidebar.
  const showIn = useRef<{ folder: string; target: string | null } | null>(null);
  const [fresh, setFresh] = useState(0);

  const putIn = useCallback(
    (cwd: string, s: OpenedSession | null) =>
      host && put(toEntry(host, cwd, s)),
    [host, put],
  );
  const preview = useCallback(
    (cwd: string, session: string, messages: AgentMessage[]) =>
      host && put(toStarting(host, cwd, session, messages)),
    [host, put],
  );
  const { reveal, show, close } = useSessionSwitch({
    host,
    folder,
    put: putIn,
    preview,
    setError,
  });

  useEffect(() => {
    if (!host || !folder) return;
    let live = true;
    const pick = showIn.current?.folder === folder ? showIn.current : null;
    showIn.current = null;
    if (pick?.target) void reveal(folder, pick.target);
    else if (pick) putIn(folder, null);
    else {
      host
        .request({ type: "open_session", cwd: folder })
        .then((s) => live && putIn(folder, s))
        .catch((e: Error) => live && setError(e.message));
    }
    return () => {
      live = false;
      synced.current = null;
      // An error belongs to the folder it happened in.
      setError(null);
    };
  }, [host, folder, putIn, reveal, synced]);

  const shown = current?.session ?? null;

  useEffect(() => {
    if (!opened || !shown || !statuses) return;
    let live = true;
    opened
      .request({ type: "session_state", session: shown })
      .then((s) => live && setState(s))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [opened, shown, statuses, setState]);

  const answer = useSessionEvents(opened, shownRef, update, setError, setState);
  const skipWait = useCallback(
    async (toolCallId: string) =>
      !!opened &&
      opened
        .request({ type: "skip_wait", toolCallId })
        .catch((e: Error) => (setError(e.message), false)),
    [opened],
  );

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

  const putOpened = useCallback(
    (s: OpenedSession | null) => folder && putIn(folder, s),
    [folder, putIn],
  );

  const none = current?.session === null;
  const actions = useComposerActions({
    opened,
    folder,
    session: shown,
    none,
    start: putOpened,
    setState,
    setError,
  });

  const draft = useDraftState(opened, none, actions.pending, statuses);

  return {
    ...view(current, draft),
    error,
    /** A fork of it is open, or its report is on the way; it takes no messages. */
    waitingOnFork: useForkWait(host, shown),
    send: actions.send,
    compact: actions.compact,
    /** Forks the shown conversation and shows the fork, empty; a refusal shows in its composer. */
    fork: () => actions.fork("", []),
    stop: actions.stop,
    unqueue: actions.unqueue,
    /** The shown conversation's id; the folder may have others open. */
    session: shown,
    ...choices(actions),
    /**
     * Shows one of the conversations of `cwd` (the shown folder by default),
     * open or saved; another folder shows it once selected.
     */
    show: (session: string, cwd = folder) => {
      if (cwd === folder) return show(session);
      if (cwd) showIn.current = { folder: cwd, target: session };
    },
    /**
     * Shows a new conversation in `cwd` (the shown folder by default), which
     * starts with its first message; another folder shows it once selected.
     */
    create: (cwd = folder) => {
      setFresh((n) => n + 1);
      if (cwd !== folder && cwd) showIn.current = { folder: cwd, target: null };
      else if (cwd) putIn(cwd, null);
    },
    /** Counts new conversations asked for, so the composer can take focus for each. */
    fresh,
    /** Closes a conversation (it stays saved); `open` is the folder's open ones, in order. */
    close: (session: string, open: string[]) => close(session, shown, open),
    /** Approves or denies a tool call that waits for the user. */
    answer,
    /** Ends a running bash call, the agent carrying on with its output so far; false when none ran. */
    skipWait,
    setTrust,
  };
}

/** The model and effort menus' actions; `pickedModel`: the user chose the model of the conversation about to start, which Model Router then leaves. */
function choices(actions: ReturnType<typeof useComposerActions>) {
  const { setModel, unpickModel, setThinkingLevel, pending } = actions;
  return {
    setModel,
    unpickModel,
    setThinkingLevel,
    pickedModel: !!pending.model,
  };
}
