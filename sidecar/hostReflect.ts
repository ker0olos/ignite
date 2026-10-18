/** The user's corrections of a conversation, reflected on once its run settles (see reflector.ts). */
import { serializeConversation } from "@earendil-works/pi-coding-agent";
import type { AgentMessage } from "../shared/agentTypes.ts";
import { LESSON_ADD_TOOL, LESSON_REMOVE_TOOL } from "../shared/lessons.ts";
import { ASK_TOOL } from "../shared/questions.ts";
import { TASK_ADD_TOOL } from "../shared/tasks.ts";
import type { Agent, HostContext } from "./hostTypes.ts";
import { LESSONS_FILE } from "./lessonExtension.ts";
import {
  addLesson,
  callText,
  lessonsFor,
  readLessons,
  removeLesson,
} from "./lessons.ts";
import { reflect } from "./reflector.ts";

const CALL_CHARS = 500;
const DROPPED_CHARS = 4_000;

type Entry = { id: string; message?: AgentMessage };

function toolCall(messages: AgentMessage[], toolCallId: string) {
  for (const m of messages) {
    if (m.role !== "assistant" || !("content" in m)) continue;
    for (const c of m.content) {
      if (c.type === "toolCall" && c.id === toolCallId) return c;
    }
  }
}

// Declining these answers the agent's proposal or question; it isn't a mistake.
const NOT_MISTAKES = new Set([
  ASK_TOOL,
  TASK_ADD_TOOL,
  LESSON_ADD_TOOL,
  LESSON_REMOVE_TOOL,
]);

/** Notes that the user denied tool call `toolCallId`, or `wrote` to the agent instead; one it can't see (a subagent's) is skipped. */
export function noteDenied(agent: Agent, toolCallId: string, wrote = false) {
  const call = toolCall(agent.session?.messages ?? [], toolCallId);
  if (!call || NOT_MISTAKES.has(call.name)) return;
  const what = `${call.name} ${callText(call.arguments)}`.slice(0, CALL_CHARS);
  (agent.corrections ??= []).push(
    wrote
      ? `The user didn't let this call run and wrote to the agent instead: ${what}`
      : `The user denied this call: ${what}`,
  );
}

/** Notes that the user rewound to before user message `entryId` of `branch`, sending `text` in its place. */
export function noteRewound(
  agent: Agent,
  branch: Entry[],
  entryId: string,
  text: string,
) {
  const from = branch.findIndex((e) => e.id === entryId);
  const dropped = branch
    .slice(from)
    .flatMap((e) => (e.message && "content" in e.message ? [e.message] : []));
  const llm = dropped as Parameters<typeof serializeConversation>[0];
  (agent.corrections ??= []).push(
    `The user rewound the conversation, dropping this:\n${serializeConversation(llm).slice(0, DROPPED_CHARS)}\n` +
      `and sent instead: ${text.slice(0, DROPPED_CHARS)}`,
  );
}

const push = (ctx: HostContext, agent: Agent) =>
  ctx.send({
    type: "lesson_proposals",
    session: agent.id,
    lessons: agent.proposals ?? [],
  });

/** Reflects on the corrections since the last settled run, and proposes what it learned. */
export async function reflectOn(
  ctx: HostContext,
  agent: Agent,
  file = LESSONS_FILE,
) {
  const corrections = agent.corrections;
  const s = agent.session;
  if (!corrections?.length || !s) return;
  agent.corrections = [];
  const existing = [
    ...lessonsFor(readLessons(file), agent.cwd),
    ...(agent.proposals ?? []),
  ].map((l) => l.text);
  const all = await reflect(s, corrections, existing);
  // Another reflection may have proposed the same while this one ran.
  const pending = new Set(agent.proposals?.map((l) => l.text));
  const found = all.filter((l) => !pending.has(l.text));
  if (!found.length || ctx.agents.get(agent.id) !== agent) return;
  agent.proposals = [...(agent.proposals ?? []), ...found];
  push(ctx, agent);
}

const proposals = (ctx: HostContext, session: string) =>
  ctx.agents.get(session)?.proposals ?? [];

/** Saves (`keep`) or discards a proposed lesson; returns those left. */
export function answerProposal(
  ctx: HostContext,
  session: string,
  id: string,
  keep: boolean,
  file = LESSONS_FILE,
) {
  const agent = ctx.agents.get(session);
  const lesson = agent?.proposals?.find((l) => l.id === id);
  if (!agent || !lesson) return proposals(ctx, session);
  if (keep) {
    const { text, level, tool, match } = lesson;
    const folder = lesson.folderOnly ? agent.cwd : undefined;
    addLesson(file, { text, level, tool, match, folder });
  }
  agent.proposals = agent.proposals!.filter((l) => l.id !== id);
  push(ctx, agent);
  return agent.proposals;
}

/** The app's lesson requests: proposals, and Settings' saved lessons. */
export const lessonHandlers = {
  lesson_proposals: (ctx: HostContext, r: { session: string }) =>
    proposals(ctx, r.session),
  lesson_answer: (
    ctx: HostContext,
    r: { session: string; lesson: string; keep: boolean },
  ) => answerProposal(ctx, r.session, r.lesson, r.keep),
  lessons_list: () => readLessons(LESSONS_FILE),
  lessons_remove: (_ctx: HostContext, r: { lesson: string }) => {
    removeLesson(LESSONS_FILE, r.lesson);
    return readLessons(LESSONS_FILE);
  },
};
