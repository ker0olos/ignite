/**
 * Demo mode's host, in place of the sidecar: every answer is made up
 * (demoConversations.ts, demoAnswers.ts), nothing runs, reads the Mac or
 * reaches a provider. A message sent gets the same scripted reply.
 */
import type {
  AgentMessage,
  AssistantMessage,
  SessionEvent,
} from "../../shared/agentTypes";
import { rankConversations, rankFiles } from "../../shared/commandSearch";
import type {
  CommandSearch,
  CommandSearchResult,
} from "../../shared/conversations";
import type {
  HostMessage,
  HostRequest,
  OpenedSession,
  SessionState,
} from "../../shared/hostProtocol";
import { DEMO_FILES, settingsAnswers } from "./demoAnswers";
import {
  DEMO_GIT_DIFFS,
  demoConversations,
  type DemoConversation,
} from "./demoConversations";
import { demoTasks, tasksAnswers } from "./demoTasks";
import { assistant } from "./demoTranscript";
import { basename } from "./paths";
import type { HostClient } from "./piHost";

type Request = Extract<HostRequest, { id: number }>;

const claude = (id: string, name: string) => ({
  provider: "claude-bridge",
  id,
  name,
});
const OPUS = claude("claude-opus-5-5", "Claude Opus 5.5");

/** The composer's model and effort in the demo. */
export const DEMO_STATE: SessionState = {
  models: [
    claude("claude-fable-5-1", "Claude Fable 5.1"),
    OPUS,
    claude("claude-sonnet-5", "Claude Sonnet 5"),
    claude("claude-haiku-4-5", "Claude Haiku 4.5"),
  ],
  model: OPUS,
  thinkingLevel: "high",
  thinkingLevels: ["off", "low", "medium", "high", "xhigh", "max"],
};

/** The demo agent's answer to anything sent to it. */
export const DEMO_REPLY =
  "This is a demo, so nothing here really runs. In your own project I'd read the code, make the change in a worktree of my own, run the tests, and bring it back as a pull request for you to review.";

const textOf = (c: DemoConversation) =>
  c.messages
    .flatMap((m) => {
      if (m.role !== "user" && m.role !== "assistant") return [];
      const { content } = m as {
        content: string | { type: string; text?: string }[];
      };
      if (typeof content === "string") return [content];
      return content.flatMap((p) => (p.type === "text" ? [p.text ?? ""] : []));
    })
    .join("\n");

const queueOf = (c: DemoConversation | undefined) =>
  c?.queue ?? { steering: [], followUp: [] };

const opened = (
  session: string,
  c: DemoConversation | undefined,
): OpenedSession => ({
  ...DEMO_STATE,
  session,
  workdir: c?.cwd ?? "",
  trust: "trusted",
  messages: c?.messages ?? [],
  running: c?.running ?? false,
  approvals: c?.approvals ?? [],
  queue: queueOf(c),
});

/** A host that shows the demo's conversations, with `tempo` the demo folder. */
export function createDemoHost(tempo: string, pace = 30): HostClient {
  const all = demoConversations(tempo);
  const find = (id: string | undefined) => all.find((c) => c.id === id);
  const listeners = new Set<(message: HostMessage) => void>();
  let made = 0;

  // Events for `session`, `pace` ms apart, as a live session sends them.
  function play(session: string, events: SessionEvent[]) {
    events.forEach((event, i) =>
      setTimeout(() => {
        for (const cb of listeners) {
          cb({ type: "session_event", session, event });
        }
      }, i * pace),
    );
  }

  function reply(session: string, text: string) {
    const user: AgentMessage = { role: "user", content: text, timestamp: 0 };
    const answer = assistant([{ type: "text", text: DEMO_REPLY }], true);
    const start: AssistantMessage = { ...answer, content: [] };
    const words = DEMO_REPLY.split(/(?<= )/);
    play(session, [
      { type: "agent_start" },
      { type: "message_start", message: user },
      { type: "message_end", message: user },
      { type: "message_start", message: start },
      {
        type: "message_update",
        assistantMessageEvent: { type: "text_start", contentIndex: 0 },
      },
      ...words.map((delta): SessionEvent => ({
        type: "message_update",
        assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta },
      })),
      { type: "message_end", message: answer },
      { type: "agent_settled" },
    ]);
  }

  function search(r: CommandSearch): CommandSearchResult {
    const indexes = r.folders.map((folder): [string, typeof index] => {
      const index = all
        .filter((c) => c.cwd === folder)
        .map((c) => ({
          id: c.id,
          title: c.title,
          modified: c.modified,
          messageCount: c.messages.length,
          text: textOf(c),
        }));
      return [folder, index];
    });
    const files = r.folders.map((folder): [string, string[]] => [
      folder,
      DEMO_FILES[basename(folder) as keyof typeof DEMO_FILES] ?? [],
    ]);
    return {
      conversations: r.kinds.includes("conversation")
        ? rankConversations(indexes, r.text, r.limit)
        : [],
      files: r.kinds.includes("file") ? rankFiles(files, r.text, r.limit) : [],
    };
  }

  function open(r: Extract<Request, { type: "open_session" }>) {
    const c = r.session
      ? find(r.session)
      : all.find((a) => a.cwd === r.cwd && a.open);
    const id = r.session ?? c?.id;
    if (!id) return null;
    // As a live session would: its running call, once the app follows it.
    const call = c?.working;
    if (call) {
      play(id, [
        {
          type: "tool_execution_start",
          toolCallId: call.id,
          toolName: call.name,
          args: call.arguments,
        },
      ]);
    }
    return opened(id, c);
  }

  const answers: Record<string, (r: never) => unknown> = {
    ...settingsAnswers(),
    open_session: open,
    new_session: () => opened(`demo-${++made}`, undefined),
    read_session: (r: { session: string }) => find(r.session)?.messages ?? [],
    session_details: (r: { session: string }) =>
      find(r.session)?.details ?? null,
    session_state: () => DEMO_STATE,
    draft_state: () => DEMO_STATE,
    set_model: () => DEMO_STATE,
    set_thinking_level: () => DEMO_STATE,
    command_search: search,
    git_diff: (r: { path: string }) => DEMO_GIT_DIFFS[r.path] ?? "",
    prompt: (r: { text: string; session?: string }) =>
      r.session && reply(r.session, r.text),
    ...tasksAnswers(demoTasks(tempo)),
  };

  return {
    // Anything else (closing, stopping, trust) has nothing to do here.
    request: async (r) => answers[r.type]?.(r as never) as never,
    send: async () => {},
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    close: async () => {},
  };
}
