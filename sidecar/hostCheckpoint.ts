import type { AgentMessage, SessionEvent } from "../shared/agentTypes.ts";
import { keepCheckpoint, takeCheckpoint } from "./checkpoints.ts";
import {
  tellsApp,
  type Agent,
  type HostContext,
  type Session,
} from "./hostTypes.ts";

type Branch = ReturnType<Session["sessionManager"]["getBranch"]>;

const isUser = (e: Branch[number]) =>
  e.type === "message" && e.message?.role === "user";

/** The branch's user message entries the app may rewind to: those after its latest compaction. */
export function rewindable(branch: Branch): Branch {
  const from = branch.findLastIndex((e) => e.type === "compaction") + 1;
  return branch.slice(from).filter(isUser);
}

/** `messages` with pi's entry id on each user message the app may rewind to. */
export function withEntryIds(
  sessionManager: Pick<Session["sessionManager"], "getBranch">,
  messages: AgentMessage[],
): AgentMessage[] {
  const ids = new Map(
    rewindable(sessionManager.getBranch()).map((e) => [
      e.message?.timestamp ?? 0,
      e.id,
    ]),
  );
  return messages.map((m) => {
    const entryId = m.role === "user" ? ids.get(m.timestamp ?? 0) : undefined;
    return entryId ? { ...m, entryId } : m;
  });
}

/** Whether the conversation works in its own worktree, which checkpoints keep; else in the folder itself. */
export const inWorktree = (agent: Agent) => agent.workdir !== agent.cwd;

/** Snapshots the worktree before a message starts a run, so no tool can change a file first. */
export async function checkpointFirst(agent: Agent) {
  if (!inWorktree(agent)) return;
  agent.snapshot = takeCheckpoint(agent.workdir);
  await agent.snapshot;
}

/**
 * Follows a user message into the conversation: its worktree's files are
 * snapshot as it starts (unless that was done before the run), and once pi
 * has saved it the snapshot is kept under its entry id, which the app gets too.
 */
export function followUserMessage(
  ctx: HostContext,
  agent: Agent,
  event: SessionEvent,
) {
  if (!("message" in event) || event.message.role !== "user") return;
  if (event.type === "message_start") {
    if (inWorktree(agent)) agent.snapshot ??= takeCheckpoint(agent.workdir);
    return;
  }
  const { message } = event;
  const taken = agent.snapshot;
  agent.snapshot = undefined;
  // pi saves the message right after its listeners hear message_end.
  queueMicrotask(() => {
    const entry = agent.session?.sessionManager
      .getBranch()
      .findLast((e) => e.message === message);
    if (!entry) return;
    if (tellsApp(ctx, agent)) {
      ctx.send({
        type: "session_event",
        session: agent.id,
        event: {
          type: "message_entry",
          timestamp: message.timestamp ?? 0,
          entryId: entry.id,
        },
      });
    }
    if (taken)
      agent.checkpoint = Promise.all([
        agent.checkpoint,
        keep(agent, entry.id, taken),
      ]);
  });
}

async function keep(agent: Agent, entry: string, taken: Promise<unknown>) {
  const commit = await taken;
  if (typeof commit === "string")
    await keepCheckpoint(agent.workdir, agent.id, entry, commit);
}
