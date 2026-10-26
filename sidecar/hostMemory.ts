/** Each conversation's runs, written to the memory once each settles (see memoryWriter.ts). */
import type { DatabaseSync } from "node:sqlite";
import type { SessionEvent } from "../shared/agentTypes.ts";
import { LESSON_ADD_TOOL, LESSON_REMOVE_TOOL } from "../shared/lessons.ts";
import { PROCEDURE } from "../shared/memory.ts";
import { TASK_TOOL } from "../shared/tasks.ts";
import { APP_NAME } from "../src/lib/app.ts";
import type { Agent } from "./hostTypes.ts";
import { memoryEnabled } from "./memory.ts";
import { addMemories, memoryDb } from "./memoryDb.ts";
import { MEMORY_TOOLS } from "./memoryExtension.ts";
import { recordedBy, withConcept } from "./memorySearch.ts";
import { write } from "./memoryWriter.ts";
import { learningOn } from "./learningSettings.ts";
import { learnsProcedures, LISTED, procedureRule } from "./procedures.ts";

// Recalling memories and keeping the plan or lessons say nothing new about the work.
const SKIP = [...MEMORY_TOOLS, TASK_TOOL, LESSON_ADD_TOOL, LESSON_REMOVE_TOOL];

/** Notes when `agent`'s run starts: after the last message it had, as pi adds the run's first after agent_start. */
export function followRun(agent: Agent, event: SessionEvent) {
  // pi starts again within a run (a retry, a compaction, a follow-up): the run began at the first.
  if (event.type === "agent_start" && agent.session)
    agent.runAfter ??= agent.session.messages.at(-1)?.timestamp ?? 0;
}

/** A path as the folder's root names it, whether the agent wrote it in its worktree or the folder. */
export const fromRoot = (roots: string[]) => (path: string) => {
  // Either separator: Windows paths use backslashes.
  const root = roots.find(
    (r) => path.startsWith(r) && /^[\\/]/.test(path.slice(r.length)),
  );
  return root ? path.slice(root.length + 1) : path;
};

/** Writes down what `agent`'s run that just settled did, unless memory is off. */
export async function rememberRun(agent: Agent, db?: DatabaseSync) {
  const s = agent.session;
  const after = agent.runAfter;
  agent.runAfter = undefined;
  if (!s || after === undefined) return;
  // By time, not position: a compaction mid-run replaces the older messages, keeping the newer ones' times.
  const run = s.messages.filter((m) => (m.timestamp ?? 0) > after);
  if (!run.some((m) => m.role === "assistant")) return;
  if (!(await memoryEnabled())) return;
  const store = db ?? memoryDb();
  const path = fromRoot([agent.workdir, agent.cwd]);
  const recorded = recordedBy(store, agent.id);
  const rule =
    learnsProcedures(run) && (await learningOn("procedures"))
      ? procedureRule(
          withConcept(store, agent.cwd, PROCEDURE, LISTED).map((m) => m.title),
        )
      : undefined;
  const written = await write(s, run, recorded, path, SKIP, rule);
  const createdAt = Date.now();
  addMemories(
    store,
    written.map((m) => ({
      ...m,
      folder: agent.cwd,
      conversation: agent.id,
      platform: APP_NAME,
      createdAt,
    })),
  );
}
