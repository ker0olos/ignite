/** The user's corrections of a conversation, reflected on once its run settles (see reflector.ts). */
import { readFileSync } from "node:fs";
import { serializeConversation } from "@earendil-works/pi-coding-agent";
import type { AgentMessage, SessionEvent } from "../shared/agentTypes.ts";
import {
  LESSON_ADD_TOOL,
  LESSON_REMOVE_TOOL,
  type Proposal,
} from "../shared/lessons.ts";
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
import { changeSkills } from "./hostMcp.ts";
import { reflect, type ReflectorSkill } from "./reflector.ts";

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

/** The agent saved a lesson itself (often the run after the correction): the reflector's proposals so far, and one still being written, are dropped. */
export function followLessons(
  ctx: HostContext,
  agent: Agent,
  event: SessionEvent,
) {
  if (event.type !== "message_end") return;
  const m = event.message;
  if (m.role !== "toolResult" || !("toolName" in m)) return;
  // Only a save carries `details.lesson`; a declined replace doesn't.
  const saved = (m.details as { lesson?: unknown } | undefined)?.lesson;
  if (m.toolName !== LESSON_ADD_TOOL || !saved) return;
  agent.corrections = [];
  agent.lessonsWritten = (agent.lessonsWritten ?? 0) + 1;
  if (!agent.proposals?.length) return;
  agent.proposals = [];
  push(ctx, agent);
}

const push = (ctx: HostContext, agent: Agent) =>
  ctx.send({
    type: "lesson_proposals",
    session: agent.id,
    lessons: agent.proposals ?? [],
  });

const textOf = (p: Proposal) =>
  p.kind === "skill" ? `${p.skill}: ${p.add}` : p.text;

const readOrNot = (file: string) => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
};

// A skill's content goes along when the run used it (read its file, or ran `/name`, which carries its path).
function skillsFor(
  ctx: HostContext,
  messages: AgentMessage[],
): ReflectorSkill[] {
  const run = JSON.stringify(messages);
  let skills;
  try {
    skills = ctx.skills.appSkills();
  } catch {
    // Unreadable skills: the reflector proposes lessons only.
    return [];
  }
  return skills.map((s) => {
    const used = run.includes(JSON.stringify(s.filePath).slice(1, -1));
    const content = used ? readOrNot(s.filePath) : undefined;
    return { name: s.name, description: s.description, content };
  });
}

const known = (agent: Agent, file: string) => [
  ...lessonsFor(readLessons(file), agent.cwd).map((l) => l.text),
  ...(agent.proposals ?? []).map(textOf),
];

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
  const written = agent.lessonsWritten;
  const all = await reflect(
    s,
    corrections,
    known(agent, file),
    skillsFor(ctx, s.messages),
  );
  // Another reflection may have proposed the same while this one ran.
  const pending = new Set(agent.proposals?.map(textOf));
  const found = all.filter((p) => !pending.has(textOf(p)));
  if (!found.length || agent.lessonsWritten !== written) return;
  if (ctx.agents.get(agent.id) !== agent) return;
  agent.proposals = [...(agent.proposals ?? []), ...found];
  push(ctx, agent);
}

const proposals = (ctx: HostContext, session: string) =>
  ctx.agents.get(session)?.proposals ?? [];

async function save(ctx: HostContext, agent: Agent, p: Proposal, file: string) {
  if (p.kind === "skill") {
    // Sessions reload, as for an imported skill, so the next run reads it.
    await changeSkills(ctx, () =>
      ctx.skills.addToSkill(p.skill, p.add, p.description),
    );
    return;
  }
  const { text, level, tool, match, regex } = p;
  const folder = p.folderOnly ? agent.cwd : undefined;
  addLesson(file, { text, level, tool, match, regex, folder });
}

/** Saves (`keep`) or discards a proposal; returns those left. */
export async function answerProposal(
  ctx: HostContext,
  session: string,
  id: string,
  keep: boolean,
  file = LESSONS_FILE,
) {
  const agent = ctx.agents.get(session);
  const proposal = agent?.proposals?.find((l) => l.id === id);
  if (!agent || !proposal) return proposals(ctx, session);
  if (keep) await save(ctx, agent, proposal, file);
  agent.proposals = (agent.proposals ?? []).filter((l) => l.id !== id);
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
