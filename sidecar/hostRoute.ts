/** With Model Router on, the router picks a new conversation's model and effort before its first message is sent. */
import type {
  ImageContent,
  RouterPick,
  SessionEvent,
  UserMessage,
} from "../shared/agentTypes.ts";
import { titleOf } from "../shared/conversations.ts";
import { autonomous } from "../shared/tasks.ts";
import { pushProjects } from "./hostProjects.ts";
import {
  isShown,
  target,
  type Agent,
  type HostContext,
  type Session,
} from "./hostTypes.ts";
import { modelRouterOn, route, type Route } from "./router.ts";
import type { Effort } from "./subagentModels.ts";

/** Notes that the user picked conversation `session`'s model or effort, so the router leaves it; noted before any await, so a send right after still sees it. */
export function userChose(
  ctx: HostContext,
  session: string | undefined,
  part: "model" | "effort",
) {
  const agent = target(ctx, session);
  if (agent) agent.chosen = { ...agent.chosen, [part]: true };
}

// Only a conversation's first message, and not a Tasks-view task's, which
// runs on the task's own pick, nor one whose model and effort the user chose.
async function routes(ctx: HostContext, agent: Agent, s: Session) {
  if (s.messages.length || !(await modelRouterOn())) return false;
  if (agent.chosen?.model && agent.chosen.effort) return false;
  const task = (await ctx.tasks.list(agent.cwd)).find(
    (t) => t.session === agent.id,
  );
  return !autonomous(task ?? null);
}

/**
 * Applies the router's pick, leaving what the user chose for this
 * conversation, and not persisted, so it never becomes the default for new
 * ones; true when it changed something. Stopped meanwhile, the conversation
 * goes back to what it ran on.
 */
async function pick(
  agent: Agent,
  s: Session,
  text: string,
  signal: AbortSignal,
) {
  const routed = await route(s, text, signal);
  if (signal.aborted) return false;
  const change = changes(agent, routed);
  if (!change.model && !change.effort) return false;
  const before = { model: s.model, effort: s.thinkingLevel };
  await runOn(s, change);
  if (!signal.aborted) return true;
  await runOn(s, before);
  return false;
}

// The router's pick, less what the user chose for this conversation.
function changes(agent: Agent, routed: Route | null): Route {
  if (!routed) return {};
  return {
    ...(!agent.chosen?.model && { model: routed.model }),
    ...(!agent.chosen?.effort && { effort: routed.effort }),
  };
}

async function runOn(
  s: Session,
  { model, effort }: { model?: Session["model"]; effort?: string },
) {
  if (model) await s.setModel(model, { persist: false });
  if (effort) s.setThinkingLevel(effort as Effort, { persist: false });
}

/** What the conversation runs on now, for the line that says what the router chose. */
function picked(s: Session, chose: boolean): RouterPick {
  const { model } = s;
  return {
    ...(model && {
      model: { provider: model.provider, id: model.id, name: model.name },
    }),
    effort: s.thinkingLevel,
    kept: !chose,
  };
}

const tell = (ctx: HostContext, agent: Agent, event: SessionEvent) => {
  if (isShown(ctx, agent)) {
    ctx.send({ type: "session_event", session: agent.id, event });
  }
};

/** The message as pi will add it, shown while the router reads it. */
function userMessage(text: string, images?: ImageContent[]): UserMessage {
  return {
    role: "user",
    content: images?.length ? [{ type: "text", text }, ...images] : text,
    timestamp: Date.now(),
  };
}

/**
 * Routes `text`, a new conversation's first message, before it's sent; false
 * when Stop (or closing the conversation) dropped it. A router that fails
 * leaves the message as it is, and a second message waits for the first.
 */
export async function routeMessage(
  ctx: HostContext,
  agent: Agent,
  s: Session,
  text: string,
  images?: ImageContent[],
): Promise<boolean> {
  if (agent.routing) throw new Error("The last message is still being read.");
  if (!(await routes(ctx, agent, s).catch(() => false))) return true;
  const routing = new AbortController();
  const message = userMessage(text, images);
  agent.routing = { text, images, message, controller: routing };
  tell(ctx, agent, { type: "routing_start", message });
  // The sidebar names it and shows it working now, not once pi has it.
  const named = !agent.title;
  if (named) agent.title = titleOf(message);
  pushProjects(ctx);
  const chose = await pick(agent, s, text, routing.signal).catch(() => false);
  agent.routing = undefined;
  const sent = !routing.signal.aborted;
  tell(ctx, agent, {
    type: "routing_end",
    sent,
    ...(sent && { picked: picked(s, chose) }),
  });
  if (sent) return true;
  if (named) agent.title = "";
  pushProjects(ctx);
  return false;
}
