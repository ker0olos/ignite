import type { AgentMessage, UserMessage } from "../shared/agentTypes.ts";
import { childrenOf } from "./hostChildren.ts";
import type { HostContext } from "./hostTypes.ts";

const TITLE_LENGTH = 80;

const isUser = (m: AgentMessage): m is UserMessage => m.role === "user";

/** A user message as a title: its first line of text, or "". */
export function titleOf(message: AgentMessage | undefined): string {
  const content = message && isUser(message) ? message.content : undefined;
  const text =
    typeof content === "string"
      ? content
      : content?.find((c) => c.type === "text")?.text;
  return (text ?? "").trim().split("\n")[0].slice(0, TITLE_LENGTH);
}

/** A conversation's title: its first user message, as the history lists it, or "" before one. */
export const firstTitle = (messages: AgentMessage[]) =>
  titleOf(messages.find(isUser));

/** Tells the app which open conversations are working or waiting. */
export function pushProjects(ctx: HostContext) {
  const agents = [...ctx.agents.values()].map((a) => {
    const review = [...a.approvals.values()]
      .map((ask) => ask.request)
      .find((r) => r.review?.kind === "pr");
    return {
      cwd: a.cwd,
      session: a.id,
      title: a.title,
      running: a.running,
      waiting: a.approvals.size > 0,
      ...(review && { review }),
      ...childrenOf(a),
    };
  });
  ctx.send({ type: "agents", agents });
  void ctx.keepAwake(agents.some((a) => a.running && !a.waiting));
}
