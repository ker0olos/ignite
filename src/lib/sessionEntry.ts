import type {
  OpenedSession,
  ProjectTrust,
  SessionState,
} from "../../shared/hostProtocol";
import type { AgentMessage } from "../../shared/agentTypes";
import type { HostClient } from "@/lib/piHost";
import { applyQueue } from "@/lib/queue";
import { applyRouting } from "@/lib/routedMessage";
import { cachedState } from "@/lib/sessionStateCache";
import {
  applyError,
  applyEvent,
  fromHistory,
  requestApproval,
  type Transcript,
} from "@/lib/transcript";

export type Opened = {
  host: HostClient;
  folder: string;
  session: string;
  /** Where its agent works (its worktree, or the folder); null while its session starts. */
  workdir: string | null;
  /** Null while its session starts, with the transcript already shown. */
  state: SessionState | null;
  trust: ProjectTrust | null;
  transcript: Transcript;
  /** Drawn from its saved messages, until opening it returns. */
  preview?: true;
};

/** A folder showing no conversation, until the user starts or picks one. */
type Empty = { host: HostClient; folder: string; session: null };

export type Entry = Opened | Empty;

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
  workdir: null,
  state: null,
  trust: null,
  transcript: fromHistory(messages, false),
  preview: true,
});

/**
 * The entry for what opening a conversation returned. A reply without
 * messages (`known`) keeps `kept`, the transcript the app followed.
 */
export const toOpened = (
  host: HostClient,
  folder: string,
  {
    session,
    workdir,
    messages,
    running,
    trust,
    modelWarning,
    approvals,
    toolRuns = [],
    queue,
    routing,
    ...state
  }: OpenedSession,
  kept?: Transcript,
): Opened => {
  if (!messages && kept) {
    return { host, folder, session, workdir, state, trust, transcript: kept };
  }
  const history = toolRuns.reduce(
    applyEvent,
    fromHistory(messages ?? [], running),
  );
  // Shown again while the router reads its first message: that message shows, timed from its send.
  const routed = routing
    ? applyRouting(history, { type: "routing_start", message: routing })
    : history;
  const transcript = approvals.reduce(
    requestApproval,
    applyQueue(routed, queue),
  );
  return {
    host,
    folder,
    session,
    workdir,
    state,
    trust,
    transcript: modelWarning
      ? applyError(transcript, modelWarning)
      : transcript,
  };
};

/** What the app sees of the session; every field is null until it's open. */
type View = {
  /** Until it's open, the last known one, so the menus draw at once. */
  state: SessionState | null;
  /** The session is open: `state` is its own. */
  ready: boolean;
  /** The conversation. */
  transcript: Transcript | null;
  /** Whether the folder's own pi resources load. */
  trust: ProjectTrust | null;
  /** The session's host, for requests outside the conversation (e.g. a diff). */
  host: HostClient | null;
  /** The folder shows no conversation; one starts only when the user asks. */
  none: boolean;
  /** Where the conversation's agent works: its worktree, or the folder. */
  workdir: string | null;
};

/** What the app sees of the entry; in a folder with none, what its first message would start with. */
export const view = (e: Entry | null, draft: SessionState | null): View =>
  isOpened(e)
    ? {
        state: e.state ?? cachedState(e.session),
        ready: !!e.state,
        transcript: e.transcript,
        trust: e.trust,
        host: e.host,
        none: false,
        workdir: e.workdir,
      }
    : {
        state: e ? (draft ?? cachedState(null)) : null,
        ready: false,
        transcript: null,
        trust: null,
        host: null,
        none: !!e,
        workdir: null,
      };
