import { useCallback, useRef, useState } from "react";
import type {
  OpenedSession,
  ProjectTrust,
  SessionState,
} from "../../shared/hostProtocol";
import type { AgentMessage } from "../../shared/agentTypes";
import type { HostClient } from "@/lib/piHost";
import {
  toOpened,
  toStarting,
  type Entry,
  type Opened,
} from "@/lib/sessionEntry";
import type { Transcript } from "@/lib/transcript";

/** How many recently shown conversations are kept (and stay rendered), so showing one again is instant. */
export const KEPT = 8;

type Shown = { host: HostClient; session: string | null };
type Store = {
  conversations: Record<string, Opened>;
  /** The conversation each folder shows. */
  shownIn: Record<string, Shown>;
  /** Newest first. */
  recent: string[];
};

const EMPTY: Store = { conversations: {}, shownIn: {}, recent: [] };

/** Points `cwd` at `session`; keeps only the recent conversations and those a folder shows. */
function pointAt(
  s: Store,
  cwd: string,
  host: HostClient,
  session: string | null,
): Store {
  const shownIn = { ...s.shownIn, [cwd]: { host, session } };
  const recent = session
    ? [session, ...s.recent.filter((r) => r !== session)].slice(0, KEPT)
    : s.recent;
  const keep = new Set<string | null>(recent);
  Object.values(shownIn).forEach((p) => keep.add(p.session));
  const conversations = Object.fromEntries(
    Object.entries(s.conversations).filter(([id]) => keep.has(id)),
  );
  return { conversations, shownIn, recent };
}

/** The folder's shown entry, if it belongs to `host`. */
function shownEntry(
  host: HostClient | null,
  folder: string | null,
  s: Store,
): Entry | null {
  const pointer = folder ? s.shownIn[folder] : undefined;
  if (!host || !folder || pointer?.host !== host) return null;
  if (pointer.session === null) return { host, folder, session: null };
  const o = s.conversations[pointer.session];
  return o?.host === host ? o : null;
}

/**
 * The conversations the app has recently shown, kept current by their
 * events, so showing one again needs nothing from the sidecar; and the one
 * each folder shows. Each is tagged with its host, so a stale one never
 * shows. Reads are synchronous: a change right after showing one reaches it.
 */
export function useSessionCache(
  host: HostClient | null,
  folder: string | null,
) {
  const [store, setStore] = useState(EMPTY);
  const ref = useRef(store);
  const update = useCallback((f: (s: Store) => Store) => {
    ref.current = f(ref.current);
    setStore(ref.current);
  }, []);
  const change = useCallback(
    (id: string | null, f: (o: Opened) => Opened) =>
      update((s) => {
        const o = id ? s.conversations[id] : undefined;
        if (o?.host !== host) return s;
        return {
          ...s,
          conversations: { ...s.conversations, [o.session]: f(o) },
        };
      }),
    [host, update],
  );
  const shownNow = useCallback(
    () => (folder ? (ref.current.shownIn[folder]?.session ?? null) : null),
    [folder],
  );
  // A followed conversation, not one still starting from its file.
  const known = useCallback(
    (session: string | null | undefined) => {
      const o = session ? ref.current.conversations[session] : undefined;
      return o?.host === host && o.state && !o.preview ? o : null;
    },
    [host],
  );
  const current = shownEntry(host, folder, store);

  return {
    current,
    opened: current?.host ?? null,
    /** Recently shown conversations, newest first, to keep rendered. */
    kept: store.recent
      .map((id) => store.conversations[id])
      .filter((o): o is Opened => o?.host === host),
    shownNow,
    /**
     * Shows what opening a conversation returned, or none. False when the
     * reply left out messages the app no longer has: open it again without `known`.
     */
    show: useCallback(
      (cwd: string, s: OpenedSession | null) => {
        if (!host) return true;
        if (!s) {
          update((st) => pointAt(st, cwd, host, null));
          return true;
        }
        const kept = ref.current.conversations[s.session];
        const followed = kept?.host === host ? kept.transcript : undefined;
        if (!s.messages && !followed) return false;
        const o = toOpened(host, cwd, s, followed);
        update((st) =>
          pointAt(
            { ...st, conversations: { ...st.conversations, [o.session]: o } },
            cwd,
            host,
            o.session,
          ),
        );
        return true;
      },
      [host, update],
    ),
    /** Shows a starting conversation from its saved messages. */
    preview: useCallback(
      (cwd: string, session: string, messages: AgentMessage[]) => {
        if (!host) return;
        const o = toStarting(host, cwd, session, messages);
        update((st) =>
          pointAt(
            { ...st, conversations: { ...st.conversations, [session]: o } },
            cwd,
            host,
            session,
          ),
        );
      },
      [host, update],
    ),
    /** Shows a followed conversation at once; false when there is none to show. */
    reshow: useCallback(
      (cwd: string, session: string) => {
        if (!host || !known(session)) return false;
        update((st) => pointAt(st, cwd, host, session));
        return true;
      },
      [host, known, update],
    ),
    /** The conversation `cwd` shows, if the app follows it. */
    knownIn: useCallback(
      (cwd: string) => known(ref.current.shownIn[cwd]?.session)?.session,
      [known],
    ),
    /** Applies an event to conversation `session`'s transcript. */
    apply: useCallback(
      (session: string, f: (t: Transcript) => Transcript) =>
        change(session, (o) => ({ ...o, transcript: f(o.transcript) })),
      [change],
    ),
    /** Sets conversation `session`'s model and effort (the shown one's by default). */
    setState: useCallback(
      (state: SessionState, session = shownNow()) =>
        change(session, (o) => ({ ...o, state })),
      [change, shownNow],
    ),
    /** Sets the trust of every kept conversation in `cwd`: it's the folder's. */
    setTrust: useCallback(
      (cwd: string, trust: ProjectTrust) =>
        Object.values(ref.current.conversations)
          .filter((o) => o.folder === cwd)
          .forEach((o) => change(o.session, (c) => ({ ...c, trust }))),
      [change],
    ),
    /** Forgets a closed conversation. */
    drop: useCallback(
      (session: string) =>
        update((s) => {
          const conversations = { ...s.conversations };
          delete conversations[session];
          const recent = s.recent.filter((r) => r !== session);
          return { ...s, conversations, recent };
        }),
      [update],
    ),
  };
}
