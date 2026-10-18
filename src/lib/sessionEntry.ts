import type {
  OpenedSession,
  ProjectTrust,
  SessionState,
} from "../../shared/hostProtocol";
import type { AgentMessage } from "../../shared/agentTypes";
import type { HostClient } from "@/lib/piHost";
import { applyQueue } from "@/lib/queue";
import { applyRouting } from "@/lib/routedMessage";
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
  /** Null while its session starts, with the transcript already shown. */
  state: SessionState | null;
  trust: ProjectTrust | null;
  transcript: Transcript;
  /** Drawn from its saved messages, until opening it returns. */
  preview?: true;
  /** Where its agent works: its own worktree, or the folder itself (outside git). */
  workdir?: string;
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
    messages,
    running,
    trust,
    modelWarning,
    approvals,
    toolRuns = [],
    queue,
    routing,
    workdir,
    ...state
  }: OpenedSession,
  kept?: Transcript,
): Opened => {
  if (!messages && kept) {
    return { host, folder, session, state, trust, workdir, transcript: kept };
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
    state,
    trust,
    workdir,
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
  /** Its agent works in the folder itself, so editing a message leaves the files. */
  filesStay: boolean;
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
        filesStay: e.workdir === e.folder,
      }
    : {
        state: e ? draft : null,
        transcript: null,
        trust: null,
        host: null,
        none: !!e,
        filesStay: false,
      };
