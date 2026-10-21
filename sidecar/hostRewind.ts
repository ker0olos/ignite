import type { ImageContent } from "../shared/agentTypes.ts";
import type { RewoundFiles } from "../shared/rewind.ts";
import { titleOf } from "../shared/conversations.ts";
import {
  restoreCheckpoint,
  restoreState,
  takeCheckpoint,
} from "./checkpoints.ts";
import { inWorktree, rewindable } from "./hostCheckpoint.ts";
import { pushProjects, refuseWhileForked } from "./hostProjects.ts";
import { settleResume } from "./hostSend.ts";
import { prompt } from "./hostSession.ts";
import {
  current,
  tellsApp,
  type Agent,
  type HostContext,
  type Session,
} from "./hostTypes.ts";

const BUSY =
  "Wait for the agent to finish (or stop it) before editing a message.";

const busy = (agent: Agent, s: Session) =>
  agent.running ||
  !!agent.routing ||
  s.isStreaming ||
  s.isCompacting ||
  agent.approvals.size > 0 ||
  s.pendingMessageCount > 0;

function refuseWhileBusy(ctx: HostContext, agent: Agent, s: Session) {
  refuseWhileForked(ctx, agent.id);
  if (busy(agent, s)) throw new Error(BUSY);
}

async function rewindFiles(agent: Agent, entryId: string) {
  if (!inWorktree(agent)) return { files: "shared" as const };
  await agent.checkpoint;
  const undo = await takeCheckpoint(agent.workdir);
  const restored = await restoreCheckpoint(agent.workdir, agent.id, entryId);
  if (!restored) return { files: "missing" as const };
  return { files: "restored" as const, undo };
}

// Files and conversation go back together: pi refusing to move puts the files back too.
async function goBack(s: Session, agent: Agent, entryId: string) {
  const { files, undo } = await rewindFiles(agent, entryId);
  try {
    if ((await s.navigateTree(entryId)).cancelled)
      throw new Error("The conversation couldn't go back to that message.");
  } catch (error) {
    if (undo) await restoreState(agent.workdir, undo).catch(() => {});
    throw error;
  }
  return files;
}

// Its title is its first message's, unless it's a fork (named after its original); its model stays.
function retitle(ctx: HostContext, agent: Agent, s: Session, text: string) {
  agent.routed = true;
  if (agent.forkOf) return;
  agent.title = titleOf({ role: "user", content: text, timestamp: 0 });
  // Saved, as the conversation list reads the file's first message, the old branch's.
  s.setSessionName(agent.title);
  pushProjects(ctx);
}

function tell(
  ctx: HostContext,
  agent: Agent,
  entryId: string,
  files: RewoundFiles,
) {
  if (!tellsApp(ctx, agent)) return;
  ctx.send({
    type: "session_event",
    session: agent.id,
    event: { type: "rewound", entryId, files },
  });
}

/**
 * Edits user message `entryId` of conversation `session`: its files go back
 * to that message's checkpoint, pi's leaf to before it (the old branch stays
 * in the file), and `text` is sent in its place. Refused unless idle.
 */
export async function rewind(
  ctx: HostContext,
  session: string,
  entryId: string,
  text: string,
  images?: ImageContent[],
) {
  const s = await current(ctx, session);
  const agent = ctx.agents.get(session)!;
  refuseWhileBusy(ctx, agent, s);
  // A cut-off run resumes before anything is rewound, else its results would land on the new branch.
  await settleResume(agent);
  refuseWhileBusy(ctx, agent, s);
  const branch = s.sessionManager.getBranch();
  if (!rewindable(branch).some((e) => e.id === entryId))
    throw new Error("That message can't be edited any more.");
  const first = branch.find((e) => e.message?.role === "user")?.id === entryId;
  const files = await goBack(s, agent, entryId);
  if (first) retitle(ctx, agent, s, text);
  tell(ctx, agent, entryId, files);
  await prompt(ctx, text, images, session);
}
