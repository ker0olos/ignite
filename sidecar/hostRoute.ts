/**
 * With Model Router on, the router picks a new conversation's model and
 * effort before its first message is sent. A model the user picked for the
 * conversation turns the router off for it: it picks nothing, effort included.
 */
import type {
  ImageContent,
  RouterPick,
  SessionEvent,
  UserMessage,
} from "../shared/agentTypes.ts";
import type { ThinkingLevel } from "../shared/hostProtocol.ts";
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
import { modelRouterOn, route } from "./router.ts";

type Pick = {
  model?: { provider: string; id: string };
  effort?: ThinkingLevel;
};

/** Notes that the user picked conversation `session`'s model, so the router leaves it; noted before any await, so a send right after still sees it. */
export function userPickedModel(ctx: HostContext, session?: string) {
  const agent = target(ctx, session);
  if (agent) agent.pickedModel = true;
}

/**
 * Runs `s` on `pick`, not persisted, so it never becomes the default for new
 * conversations; true when its model was available (one that isn't leaves the
 * model as it is).
 */
export async function runOn(s: Session, { model, effort }: Pick) {
  const found =
    model &&
    (await s.modelRuntime.getAvailable()).find(
      (m) => m.provider === model.provider && m.id === model.id,
    );
  if (found) await s.setModel(found, { persist: false });
  if (effort) s.setThinkingLevel(effort, { persist: false });
  return !!found;
}

// Only a conversation's first message, and not one whose model the user
// picked; a Tasks-view task's own model counts while it's still available.
async function routes(ctx: HostContext, agent: Agent, s: Session) {
  if (s.messages.length || agent.pickedModel) return false;
  if (!(await modelRouterOn())) return false;
  const task = (await ctx.tasks.list(agent.cwd)).find(
    (t) => t.session === agent.id,
  );
  if (!task?.model || !autonomous(task)) return true;
  return !(await s.modelRuntime.getAvailable()).some(
    (m) => m.provider === task.model!.provider && m.id === task.model!.id,
  );
}

/**
 * Applies the router's pick; true when it had one. Stopped meanwhile, the
 * conversation goes back to what it ran on.
 */
async function pick(s: Session, text: string, signal: AbortSignal) {
  const routed = await route(s, text, signal);
  if (signal.aborted || !(routed?.model || routed?.effort)) return false;
  const before = { model: s.model, effort: s.thinkingLevel };
  await runOn(s, routed);
  if (!signal.aborted) return true;
  await runOn(s, before);
  return false;
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
  const routing = new AbortController();
  const message = userMessage(text, images);
  // Taken before any await, so a second message sent meanwhile waits.
  agent.routing = { text, images, message, controller: routing };
  if (!(await routes(ctx, agent, s).catch(() => false))) {
    agent.routing = undefined;
    return !routing.signal.aborted;
  }
  tell(ctx, agent, { type: "routing_start", message });
  // The sidebar names it and shows it working now, not once pi has it.
  const named = !agent.title;
  if (named) agent.title = titleOf(message);
  pushProjects(ctx);
  const chose = await pick(s, text, routing.signal).catch(() => false);
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
