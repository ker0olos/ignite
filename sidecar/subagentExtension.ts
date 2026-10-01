/**
 * The subagent tool: the main agent hands work to another model from its own
 * provider, at a lower effort, and talks back and forth with it by id. The
 * host opens each subagent's session (SUBAGENT_EVENT); its tool calls go
 * through the same approvals. `[subagents]` in settings.toml turns it off or
 * caps how many one conversation may start; read before each run.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  AgentSession,
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { parse as parseToml } from "smol-toml";
import { Type } from "typebox";
import type { AgentMessage, AssistantMessage } from "../shared/agentTypes.ts";
import {
  EFFORTS,
  nextSubagentId,
  readSubagent,
  SUBAGENT_TOOL,
  type SubagentDetails,
} from "../shared/subagents.ts";
import { APP_NAME } from "../src/lib/app.ts";

/** pi event bus channel asking the host to open a subagent's session. */
export const SUBAGENT_EVENT = "app/subagent";

type Effort = (typeof EFFORTS)[number];
type Model = NonNullable<ExtensionContext["model"]>;

/** A subagent session request on the event bus; `reply` gets the session. */
export type SubagentAsk = {
  model: Model;
  effort: Effort;
  reply(session: Promise<AgentSession>): void;
};

/** Appended to every subagent's system prompt. */
export const WORKER = `## Working as a subagent
Another agent gave you this task and reads your final reply; the user doesn't see it. Do the work, then reply with what you found or changed, briefly and completely. If you need a decision or information from that agent, end your reply with the question; its answer comes as your next message.`;

type Limits = { enabled: boolean; max: number };

/** `[subagents]` in the app's settings: on, at most 2 per conversation, by default. */
export async function subagentLimits(
  settingsFile = join(homedir(), `.${APP_NAME}`, "settings.toml"),
): Promise<Limits> {
  try {
    const settings = parseToml(await readFile(settingsFile, "utf8"));
    const s = (settings.subagents ?? {}) as {
      enabled?: unknown;
      max?: unknown;
    };
    const max = typeof s.max === "number" && s.max >= 1 ? Math.floor(s.max) : 2;
    return { enabled: s.enabled !== false, max };
  } catch {
    return { enabled: true, max: 2 };
  }
}

// Subscription providers (claude-bridge) list no prices; the same model's
// API listing (anthropic) has them.
function price(model: Model, all: Model[]): number | undefined {
  const priced = (m: Model) => (m.cost?.output > 0 ? m.cost.output : undefined);
  return (
    priced(model) ??
    all
      .filter((m) => m.id === model.id)
      .map(priced)
      .find((p) => p)
  );
}

/** Models a subagent may use: the main model's provider, cheaper per output token than the main model. */
export function allowedModels(ctx: ExtensionContext): Model[] {
  const own = ctx.model;
  const all = ctx.modelRegistry.getAll();
  const ceiling = own && price(own, all);
  if (!own || !ceiling) return [];
  return ctx.modelRegistry.getAvailable().filter((m) => {
    const cost = price(m, all);
    return m.provider === own.provider && !!cost && cost < ceiling;
  });
}

/** Efforts below the main agent's own. */
export function allowedEfforts(own: string): Effort[] {
  return EFFORTS.slice(0, Math.max(0, EFFORTS.indexOf(own as Effort)));
}

export function guidance(models: Model[], efforts: Effort[], left: number) {
  return `## Subagents
With the ${SUBAGENT_TOOL} tool you can hand a self-contained task to a subagent: it works in the same folder with the same tools and its final reply comes back to you. You may start ${left} more in this conversation.
- Models (smaller than yours): ${models.map((m) => m.id).join(", ")}. Efforts: ${efforts.join(", ")}.
- It can't see this conversation, so give it everything it needs in the message.
- To answer its question or give it more work, call ${SUBAGENT_TOOL} again with its id and your message.
- Several calls in one turn run at the same time.`;
}

const Params = Type.Object({
  message: Type.String({
    description:
      "The task for a new subagent, or your message to an existing one.",
  }),
  id: Type.Optional(
    Type.String({
      description: "An existing subagent's id, to continue with it.",
    }),
  ),
  model: Type.Optional(
    Type.String({ description: "A new subagent's model id (see Subagents)." }),
  ),
  effort: Type.Optional(
    Type.String({ description: "A new subagent's effort (see Subagents)." }),
  ),
});

type Agent = Omit<SubagentDetails, "messages" | "running"> & {
  opening: Promise<AgentSession>;
};

// A reload starts `agents` empty, but the saved calls keep their ids.
const savedIds = (ctx: ExtensionContext) =>
  ctx.sessionManager.getEntries().flatMap((e) => {
    const m = e.type === "message" ? e.message : undefined;
    const id = m?.role === "toolResult" && readSubagent(m.details)?.id;
    return id ? [id] : [];
  });

const replyOf = (messages: AgentMessage[]) => {
  const last = messages.findLast((m) => m.role === "assistant") as
    AssistantMessage | undefined;
  if (!last) return "(no reply)";
  if (last.stopReason === "error") return `It failed: ${last.errorMessage}`;
  const text = last.content.flatMap((b) => (b.type === "text" ? [b.text] : []));
  return text.join("\n") || "(no reply)";
};

/** The requested model and effort, if the rules allow them. */
function pick(
  params: { model?: string; effort?: string },
  ctx: ExtensionContext,
  own: string,
) {
  const models = allowedModels(ctx);
  const model = models.find((m) => m.id === params.model);
  if (!model) {
    throw new Error(
      `Pick a model from: ${models.map((m) => m.id).join(", ")}.`,
    );
  }
  const efforts = allowedEfforts(own);
  const effort = efforts.find((e) => e === params.effort);
  if (!effort) {
    throw new Error(`Pick an effort below your own: ${efforts.join(", ")}.`);
  }
  return { model, effort };
}

/** Sends the subagent a message and waits for its reply, reporting progress. */
async function talk(
  agent: Agent,
  message: string,
  signal: AbortSignal | undefined,
  onUpdate:
    ((result: { content: []; details: SubagentDetails }) => void) | undefined,
) {
  const session = await agent.opening;
  if (session.isStreaming)
    throw new Error(`${agent.id} is still busy with another message.`);
  const from = session.messages.length;
  const details = (running: boolean): SubagentDetails => ({
    id: agent.id,
    model: agent.model,
    effort: agent.effort,
    messages: session.messages.slice(from) as AgentMessage[],
    running,
  });
  const unsubscribe = session.subscribe((event) => {
    if (event.type === "message_end" || event.type === "tool_execution_end") {
      onUpdate?.({ content: [], details: details(true) });
    }
  });
  const stop = () => void session.abort();
  signal?.addEventListener("abort", stop);
  try {
    await session.prompt(message);
  } finally {
    unsubscribe();
    signal?.removeEventListener("abort", stop);
  }
  const done = details(false);
  const text = `${agent.id} replied:\n\n${replyOf(done.messages)}`;
  return { content: [{ type: "text" as const, text }], details: done };
}

export default function subagents(pi: ExtensionAPI) {
  // ponytail: per loaded session; a reload or sidecar restart forgets them (and resets the count).
  const agents = new Map<string, Agent>();
  let limits: Limits = { enabled: true, max: 2 };

  const open = (model: Model, effort: Effort) => {
    let session: Promise<AgentSession> | undefined;
    pi.events.emit(SUBAGENT_EVENT, {
      model,
      effort,
      reply: (s) => (session = s),
    } satisfies SubagentAsk);
    if (!session) throw new Error("Subagents aren't available here.");
    return session;
  };

  async function start(
    params: { model?: string; effort?: string },
    ctx: ExtensionContext,
  ): Promise<Agent> {
    if (!limits.enabled) throw new Error("Subagents are turned off.");
    if (agents.size >= limits.max) {
      throw new Error(
        `This conversation already has ${limits.max} subagents; continue with one of them by id.`,
      );
    }
    const { model, effort } = pick(params, ctx, pi.getThinkingLevel());
    const id = nextSubagentId([...agents.keys(), ...savedIds(ctx)]);
    // Taken before any await, so parallel calls can't pass the cap together.
    const agent = { id, model: model.id, effort, opening: open(model, effort) };
    agents.set(id, agent);
    try {
      await agent.opening;
    } catch (error) {
      agents.delete(id);
      throw error;
    }
    return agent;
  }

  pi.registerTool({
    name: SUBAGENT_TOOL,
    label: "Subagent",
    description:
      "Start a subagent on a task with a smaller model and lower effort, or send a message to one you started (by id). Returns its reply.",
    parameters: Params,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const known = params.id === undefined ? undefined : agents.get(params.id);
      if (params.id !== undefined && !known) {
        throw new Error(`There is no subagent ${params.id}; start a new one.`);
      }
      const agent = known ?? (await start(params, ctx));
      return talk(agent, params.message, signal, onUpdate);
    },
  });

  pi.on("before_agent_start", async (event, ctx) => {
    limits = await subagentLimits();
    const models = allowedModels(ctx);
    const efforts = allowedEfforts(pi.getThinkingLevel());
    const left = limits.max - agents.size;
    const usable = limits.enabled && models.length > 0 && efforts.length > 0;
    const others = pi.getActiveTools().filter((name) => name !== SUBAGENT_TOOL);
    // Out of new ones, it can still talk to the ones it has.
    const on = usable && (left > 0 || agents.size > 0);
    pi.setActiveTools(on ? [...others, SUBAGENT_TOOL] : others);
    if (!on) return;
    return {
      systemPrompt: `${event.systemPrompt}\n\n${guidance(models, efforts, left)}`,
    };
  });

  pi.on("session_shutdown", async () => {
    for (const { opening } of agents.values()) {
      const session = await opening.catch(() => null);
      if (!session) continue;
      await session.extensionRunner.emit({
        type: "session_shutdown",
        reason: "quit",
      });
      session.dispose();
    }
    agents.clear();
  });
}
