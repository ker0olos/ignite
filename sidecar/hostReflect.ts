/** The user's feedback on a conversation, reflected on once its run settles (see reflector.ts). */
import type {
  AgentMessage,
  ToolResultMessage,
  UserMessage,
} from "../shared/agentTypes.ts";
import { LESSON_ADD_TOOL, LESSON_REMOVE_TOOL } from "../shared/lessons.ts";
import {
  ASK_TOOL,
  type AskDetails,
  type Question,
} from "../shared/questions.ts";
import { MAX_REFLECTION_CHARS, type Reflection } from "../shared/reflector.ts";
import { typedSkill } from "../shared/skills.ts";
import { TASK_ADD_TOOL } from "../shared/tasks.ts";
import type { Agent, HostContext, SessionStore } from "./hostTypes.ts";
import { isForkReport } from "./forks.ts";
import { learningOn } from "./learningSettings.ts";
import { callText } from "./lessons.ts";
import { scrubText } from "./memoryWriter.ts";
import { reflect } from "./reflector.ts";
import { conversationText } from "./roleLabelsExtension.ts";
import { WRAP_UP } from "./taskExtension.ts";
import {
  appliesIn,
  readReflections,
  REFLECTOR_FILE,
  writeReflections,
} from "./reflectorExtension.ts";

const CALL_CHARS = 500;
const OTHER_CONVERSATIONS = 5;
const ASKS = 12;
const ASK_CHARS = 300;
const FEEDBACK_CHARS = 2_000;
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

// Declining these answers the agent's proposal or question; ask_user's answers are read from the run.
const NOT_FEEDBACK = new Set([
  ASK_TOOL,
  TASK_ADD_TOOL,
  LESSON_ADD_TOOL,
  LESSON_REMOVE_TOOL,
]);

/** Notes that the user denied tool call `toolCallId`, or `wrote` to the agent instead; one it can't see (a subagent's) is skipped. */
export function noteDenied(agent: Agent, toolCallId: string, wrote = false) {
  const call = toolCall(agent.session?.messages ?? [], toolCallId);
  if (!call || NOT_FEEDBACK.has(call.name)) return;
  const what = `${call.name} ${callText(call.arguments)}`.slice(0, CALL_CHARS);
  (agent.corrections ??= []).push(
    wrote
      ? `The user didn't let this call run and wrote to the agent instead: ${what}`
      : `The user denied this call: ${what}`,
  );
}

/** Notes that the user rewound to before user message `entryId` of `branch`; the message they sent in its place starts the next run. */
export function noteRewound(agent: Agent, branch: Entry[], entryId: string) {
  const from = branch.findIndex((e) => e.id === entryId);
  const dropped = branch
    .slice(from)
    .flatMap((e) => (e.message && "content" in e.message ? [e.message] : []));
  (agent.corrections ??= []).push(
    `The user rewound the conversation, dropping this:\n${conversationText(dropped).slice(0, DROPPED_CHARS)}\n` +
      "and sent the run's message instead.",
  );
}

const textOf = ({ content }: UserMessage) =>
  typeof content === "string"
    ? content
    : content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("\n");

// The options each question offered, to tell an answer the user wrote from a pick.
function offered(messages: AgentMessage[], m: ToolResultMessage) {
  const args = toolCall(messages, m.toolCallId)?.arguments as
    { questions?: Question[] } | undefined;
  return new Set(
    (args?.questions ?? []).flatMap((q) => q.options.map((o) => o.label)),
  );
}

// Only answers the user wrote something in: a note, or their own answer. A pick alone is a choice for this task.
function answersOf(messages: AgentMessage[], m: ToolResultMessage): string[] {
  if (m.toolName !== ASK_TOOL) return [];
  const labels = offered(messages, m);
  const answers = (m.details as AskDetails | undefined)?.answers ?? [];
  return answers
    .filter((a) => a.note || a.choices.some((c) => !labels.has(c)))
    .map(
      (a) =>
        `The agent asked "${a.question}"; the user answered ${a.choices.join(", ") || "(nothing picked)"}` +
        (a.note ? `, with the note: ${a.note.slice(0, FEEDBACK_CHARS)}` : ""),
    );
}

/** Whether a user message's text is one the app sends as theirs: a task's wrap-up or a fork's report. */
export const fromApp = (text: string) => text === WRAP_UP || isForkReport(text);

// What the user typed in message `m`, private text hidden; "" for what the app sends as theirs.
function typedIn(m: AgentMessage) {
  const text = typedSkill(textOf(m as UserMessage).trim());
  return fromApp(text) ? "" : scrubText(text);
}

/** What the user said in the run after `after` (by time): their messages, but the conversation's opening one and the app's, and what they wrote answering the agent's questions. */
export function feedbackOf(messages: AgentMessage[], after: number): string[] {
  let opened = messages.some(
    (m) => m.role === "user" && (m.timestamp ?? 0) <= after,
  );
  return messages.flatMap((m) => {
    if ((m.timestamp ?? 0) <= after) return [];
    if (m.role === "toolResult")
      return answersOf(messages, m as ToolResultMessage);
    if (m.role !== "user") return [];
    if (!opened) {
      opened = true;
      return [];
    }
    const text = typedIn(m);
    return text ? [`The user wrote: ${text.slice(0, FEEDBACK_CHARS)}`] : [];
  });
}

// A fork's copy of a message keeps its time, so the same time and text is the same message.
const sent = (m: AgentMessage) => `${m.timestamp}:${typedIn(m)}`;

// What the user typed in a conversation, its latest; not messages copied to or from `own` (a fork's, or its original's).
function asksOf(messages: AgentMessage[], own: Set<string>) {
  return messages
    .flatMap((m) => {
      if (m.role !== "user" || own.has(sent(m))) return [];
      const text = typedIn(m);
      return text ? [text.slice(0, ASK_CHARS)] : [];
    })
    .slice(-ASKS);
}

type Saved = Pick<SessionStore, "list" | "read">;

/** What the user asked in `folder`'s latest conversations but `id` (whose messages are `mine`), newest first; none when they can't be read. */
async function askedElsewhere(
  sessions: Saved,
  folder: string,
  id: string,
  mine: AgentMessage[],
): Promise<string[][]> {
  try {
    // ponytail: list() reads every saved conversation of the folder; a cheaper newest-files listing if folders grow to hundreds.
    const latest = (await sessions.list(folder))
      .filter((c) => c.id !== id)
      .slice(0, OTHER_CONVERSATIONS);
    const read = await Promise.all(
      latest.map((c) => sessions.read(folder, c.id)),
    );
    const own = new Set(mine.filter((m) => m.role === "user").map(sent));
    return read.map((m) => asksOf(m, own)).filter((asks) => asks.length);
  } catch {
    return [];
  }
}

// One at a time, so two conversations settling together don't each overwrite the other's change.
let reflecting = Promise.resolve();

/** Reflects on the user's feedback in `agent`'s run that just settled (with what they asked in its folder's other conversations, from `sessions`), rewriting the points that apply in its folder. */
export function reflectOn(
  agent: Agent,
  { file = REFLECTOR_FILE, sessions }: { file?: string; sessions?: Saved } = {},
) {
  const s = agent.session;
  const after = agent.runAfter;
  if (!s || after === undefined) return reflecting;
  const corrections = agent.corrections ?? [];
  agent.corrections = [];
  const messages = [...s.messages];
  const feedback = [...corrections, ...feedbackOf(messages, after)];
  if (!feedback.length) return reflecting;
  reflecting = reflecting
    .then(async () => {
      if (!(await learningOn("reflector"))) return;
      const from = {
        conversation: agent.id,
        folder: agent.cwd,
        title: agent.title ?? "",
      };
      const all = readReflections(file);
      const here = appliesIn(agent.cwd);
      const elsewhere = sessions
        ? await askedElsewhere(sessions, agent.cwd, agent.id, messages)
        : [];
      const next = await reflect(
        s,
        feedback,
        messages,
        all.filter(here),
        from,
        elsewhere,
      );
      if (next)
        writeReflections([...next, ...all.filter((p) => !here(p))], file);
    })
    .catch(() => {});
  return reflecting;
}

/** Settings' reflector points: list, remove, and edit one (it's then the user's own). */
export const reflectorHandlers = {
  reflections_list: () => readReflections(REFLECTOR_FILE),
  reflections_remove: (_ctx: HostContext, r: { reflection: string }) =>
    change(REFLECTOR_FILE, (all) => all.filter((p) => p.id !== r.reflection)),
  reflections_edit: (
    _ctx: HostContext,
    r: { reflection: string; text: string },
  ) => {
    const text = r.text.trim().slice(0, MAX_REFLECTION_CHARS);
    return change(REFLECTOR_FILE, (all) =>
      text
        ? all.map((p) =>
            p.id === r.reflection && p.text !== text
              ? {
                  ...p,
                  text,
                  taught: "edit" as const,
                  at: Date.now(),
                  from: undefined,
                  // Wholly the user's own now, for all work: the feedback's situation and words no longer apply.
                  when: undefined,
                  evidence: undefined,
                  folder: undefined,
                }
              : p,
          )
        : all.filter((p) => p.id !== r.reflection),
    );
  },
};

/** Applies `edit` to the points, after any reflection running, and returns them. */
function change(
  file: string,
  edit: (all: Reflection[]) => Reflection[],
): Promise<Reflection[]> {
  const done = reflecting.then(() => {
    writeReflections(edit(readReflections(file)), file);
    return readReflections(file);
  });
  reflecting = done.then(
    () => {},
    () => {},
  );
  return done;
}
