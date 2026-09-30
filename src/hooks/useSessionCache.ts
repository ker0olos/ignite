import { useCallback, useEffect, useRef, useState } from "react";
import type {
  OpenedSession,
  ProjectTrust,
  SessionState,
} from "../../shared/hostProtocol";
import type { AgentMessage } from "../../shared/agentTypes";
import type { HostClient } from "@/lib/piHost";
import { applyQueue } from "@/lib/queue";
import {
  applyError,
  fromHistory,
  requestApproval,
  type Transcript,
} from "@/lib/transcript";

export type Opened = {
  host: HostClient;
  folder: string;
  session: string;
  /** Null while its session starts, with the transcript already shown. */
  state: SessionState | null;
  trust: ProjectTrust | null;
  transcript: Transcript;
};

/** A folder showing no conversation, until the user starts or picks one. */
type Empty = { host: HostClient; folder: string; session: null };

type Entry = Opened | Empty;

const isOpened = (e: Entry | null): e is Opened => !!e && e.session !== null;

/** A conversation whose session is starting, shown from its saved messages. */
export const toStarting = (
  host: HostClient,
  folder: string,
  session: string,
  messages: AgentMessage[],
): Opened => ({
  host,
  folder,
  session,
  state: null,
  trust: null,
  transcript: fromHistory(messages, false),
});

/** The cache entry for what opening a folder's conversation returned. */
export const toEntry = (
  host: HostClient,
  folder: string,
  s: OpenedSession | null,
): Entry => (s ? toOpened(host, folder, s) : { host, folder, session: null });

const toOpened = (
  host: HostClient,
  folder: string,
  {
    session,
    messages,
    running,
    trust,
    modelWarning,
    approvals,
    queue,
    ...state
  }: OpenedSession,
): Opened => {
  const transcript = approvals.reduce(
    requestApproval,
    applyQueue(fromHistory(messages, running), queue),
  );
  return {
    host,
    folder,
    session,
    state,
    trust,
    transcript: modelWarning
      ? applyError(transcript, modelWarning)
      : transcript,
  };
};

/** What the app sees of the session; every field is null until it's open. */
type View = {
  state: SessionState | null;
  /** The conversation. */
  transcript: Transcript | null;
  /** Whether the folder's own pi resources load. */
  trust: ProjectTrust | null;
  /** The session's host, for requests outside the conversation (e.g. a diff). */
  host: HostClient | null;
  /** The folder shows no conversation; one starts only when the user asks. */
  none: boolean;
};

/** What the app sees of the entry; in a folder with none, what its first message would start with. */
export const view = (e: Entry | null, draft: SessionState | null): View =>
  isOpened(e)
    ? {
        state: e.state,
        transcript: e.transcript,
        trust: e.trust,
        host: e.host,
        none: false,
      }
    : {
        state: e ? draft : null,
        transcript: null,
        trust: null,
        host: null,
        none: !!e,
      };

/**
 * Every open folder's last known session, so switching back shows it at once;
 * each is tagged with its host, so a stale one never shows. Also the
 * conversation events apply to, which changes as soon as another is put
 * (before the next render).
 */
export function useSessionCache(
  host: HostClient | null,
  folder: string | null,
) {
  const [sessions, setSessions] = useState<Record<string, Entry>>({});
  const shownRef = useRef<string | null>(null);
  // Events only apply once the sidecar has answered for this folder.
  const synced = useRef<string | null>(null);
  const folderRef = useRef(folder);
  useEffect(() => {
    folderRef.current = folder;
  }, [folder]);
  const cached = folder ? sessions[folder] : undefined;
  const current = cached?.host === host ? cached : null;
  const opened = current?.host ?? null;
  // A late answer for a folder no longer shown is kept, but events stay the shown one's.
  const put = useCallback((e: Entry) => {
    if (e.folder === folderRef.current) {
      shownRef.current = e.session;
      synced.current = e.folder;
    }
    setSessions((all) => ({ ...all, [e.folder]: e }));
  }, []);
  const patch = useCallback(
    (f: (o: Opened) => Opened) =>
      setSessions((all) => {
        const o = folder ? all[folder] : undefined;
        return isOpened(o ?? null)
          ? { ...all, [o!.folder]: f(o as Opened) }
          : all;
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

  return {
    current,
    opened,
    shownRef,
    synced,
    put,
    patch,
    setState,
    update,
  };
}
