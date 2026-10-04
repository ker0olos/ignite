/**
 * The subagent tool: the main agent hands work to its own model or a cheaper
 * one from its provider, at its effort or lower, and talks with it by id. The
 * host opens each subagent's session (SUBAGENT_EVENT); its tool calls go
 * through the same approvals. `[subagents]` in settings.toml turns it off or
 * caps how many of a conversation's run at once (the rest queue); read before each run.
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
import {
  nextSubagentId,
  readSubagent,
  SUBAGENT_TOOL,
} from "../shared/subagents.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { concurrency } from "./subagentQueue.ts";
import {
  allowedEfforts,
  allowedModels,
  type Effort,
  type Model,
  pick,
} from "./subagentModels.ts";
import { type Agent, end, talk } from "./subagentSession.ts";

/** pi event bus channel asking the host to open a subagent's session. */
export const SUBAGENT_EVENT = "app/subagent";

/** A subagent session request on the event bus; `reply` gets the session. */
export type SubagentAsk = {
  model: Model;
  effort: Effort;
  /** Only these tools, when set (an explore subagent). */
  tools?: string[];
  /** Appended to its system prompt. */
  prompt: string;
  reply(session: Promise<AgentSession>): void;
};

/** Appended to every other subagent's system prompt. */
const WORKER = `## Working as a subagent
Another agent gave you this task and reads your final reply; the user doesn't see it. Do the work, then reply with what you found or changed, briefly and completely. If you need a decision or information from that agent, end your reply with the question; its answer comes as your next message.`;

/** The only tools an explore subagent gets. */
const EXPLORE_TOOLS = ["read", "grep", "find", "ls", "outline"];

/** Appended to an explore subagent's system prompt, in place of WORKER. */
const EXPLORER = `## Exploring as a subagent
Another agent asked you to find something in the code and reads your final reply; the user doesn't see it. You can only search and read. Make independent grep, find and read calls together in one turn, start broad (grep with filesOnly), outline long files, then read only the parts that matter, and follow the code to where the answer really is. Reply with your conclusion and the file:line references that support it, each with a line on why it matters. Don't paste file contents.`;

type Limits = { enabled: boolean; max: number };

/** `[subagents]` in the app's settings: on, at most 2 running at once, by default. */
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

export function guidance(models: Model[], efforts: Effort[], max: number) {
  return `## Subagents
With the ${SUBAGENT_TOOL} tool you can hand a self-contained task to a subagent: it works in the same folder with the same tools and its final reply comes back to you. Start as many as the work needs: ${max} run at a time and the rest wait their turn.
- Models (yours or cheaper): ${models.map((m) => m.id).join(", ")}. Efforts: ${efforts.join(", ")}. Leave them out to use your own.
- Give each new one a short description, shown to the user.
- It can't see this conversation, so give it everything it needs in the message.
- To answer its question or give it more work, call ${SUBAGENT_TOOL} again with its id and your message.
- Several calls in one turn run at the same time, up to that limit.
- Only the ${KEPT} you used last stay open to continue by id; older ones end.
- For questions about the code that need a wide search, start it with explore: true: it can only read and search, and replies with its findings and file:line references, so the search stays out of your context. Leave out model and effort to run it on the cheapest model at low effort. Say how thorough to be.`;
}

const Params = Type.Object({
  message: Type.String({
    description:
      "The task for a new subagent, or your message to an existing one.",
  }),
  description: Type.Optional(
    Type.String({
      description:
        'What it does, in 3 to 6 words, shown to the user (e.g. "Find: removed behaviour").',
    }),
  ),
  id: Type.Optional(
    Type.String({
      description: "An existing subagent's id, to continue with it.",
    }),
  ),
  model: Type.Optional(
    Type.String({
      description:
        "A new subagent's model id (see Subagents); yours if left out.",
    }),
  ),
  effort: Type.Optional(
    Type.String({
      description:
        "A new subagent's effort (see Subagents); yours if left out.",
    }),
  ),
  explore: Type.Optional(
    Type.Boolean({
      description:
        "Start a new subagent that can only read and search, to find something in the code.",
    }),
  ),
});

/** Idle subagents kept open to continue by id; the least recently used past this end. */
const KEPT = 8;

// A reload starts `agents` empty, but the saved calls keep their ids.
const savedIds = (ctx: ExtensionContext) =>
  ctx.sessionManager.getEntries().flatMap((e) => {
    const m = e.type === "message" ? e.message : undefined;
    const id = m?.role === "toolResult" && readSubagent(m.details)?.id;
    return id ? [id] : [];
  });

export default function subagents(pi: ExtensionAPI) {
  // ponytail: per loaded session, most recently used last; a reload or sidecar restart forgets them.
  const agents = new Map<string, Agent>();
  let limits: Limits = { enabled: true, max: 2 };
  const queue = concurrency(() => limits.max);

  const trim = () => {
    const idle = [...agents.values()].filter((a) => a.session && !a.busy);
    for (const agent of idle.slice(0, Math.max(0, idle.length - KEPT))) {
      agents.delete(agent.id);
      void end(agent.opening);
    }
  };

  /** Runs with the agent already marked busy, then marks it most recently used and ends the oldest idle ones. */
  async function use(agent: Agent, run: () => ReturnType<typeof talk>) {
    try {
      return await run();
    } finally {
      agent.busy--;
      if (agents.delete(agent.id)) agents.set(agent.id, agent);
      trim();
    }
  }

  const open = (model: Model, effort: Effort, explore: boolean) => {
    let session: Promise<AgentSession> | undefined;
    pi.events.emit(SUBAGENT_EVENT, {
      model,
      effort,
      tools: explore ? EXPLORE_TOOLS : undefined,
      prompt: explore ? EXPLORER : WORKER,
      reply: (s) => (session = s),
    } satisfies SubagentAsk);
    if (!session) throw new Error("Subagents aren't available here.");
    return session;
  };

  async function start(
    { model, effort }: { model: Model; effort: Effort },
    explore: boolean,
    ctx: ExtensionContext,
  ): Promise<Agent> {
    const id = nextSubagentId([...agents.keys(), ...savedIds(ctx)]);
    // Taken before any await, so parallel calls can't share an id.
    const agent: Agent = {
      id,
      model: model.id,
      effort,
      opening: open(model, effort, explore),
      busy: 1,
    };
    agents.set(id, agent);
    try {
      agent.session = await agent.opening;
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
      "Start a subagent on a task with your model or a cheaper one, at your effort or lower, or send a message to one you started (by id). Returns its reply.",
    parameters: Params,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const known = params.id === undefined ? undefined : agents.get(params.id);
      if (params.id !== undefined && !known) {
        throw new Error(`There is no subagent ${params.id}; start a new one.`);
      }
      if (!known && !limits.enabled) {
        throw new Error("Subagents are turned off.");
      }
      // Checked before waiting, so a bad pick fails at once.
      const picked = known
        ? undefined
        : pick(params, ctx, pi.getThinkingLevel());
      return queue(async () => {
        const agent = known
          ? agents.get(known.id)
          : await start(picked!, !!params.explore, ctx);
        if (!agent) {
          throw new Error(`${known!.id} has ended; start a new one.`);
        }
        // A new one comes back from start already busy.
        if (known) agent.busy++;
        return use(agent, () => talk(agent, params.message, signal, onUpdate));
      }, signal);
    },
  });

  pi.on("before_agent_start", async (event, ctx) => {
    limits = await subagentLimits();
    const models = allowedModels(ctx);
    const efforts = allowedEfforts(pi.getThinkingLevel());
    const on = limits.enabled && models.length > 0 && efforts.length > 0;
    const others = pi.getActiveTools().filter((name) => name !== SUBAGENT_TOOL);
    pi.setActiveTools(on ? [...others, SUBAGENT_TOOL] : others);
    if (!on) return;
    return {
      systemPrompt: `${event.systemPrompt}\n\n${guidance(models, efforts, limits.max)}`,
    };
  });

  pi.on("session_shutdown", async () => {
    for (const { opening } of agents.values()) await end(opening);
    agents.clear();
  });
}
