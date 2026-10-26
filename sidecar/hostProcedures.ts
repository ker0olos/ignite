import type { DatabaseSync } from "node:sqlite";
import { PROCEDURE } from "../shared/memory.ts";
import type { Procedure } from "../shared/procedures.ts";
import type { HostContext } from "./hostTypes.ts";
import { memoryDb, removeMemory, type Memory } from "./memoryDb.ts";
import { isProcedure, withConcept } from "./memorySearch.ts";

// ponytail: Settings lists the newest 500; paging if a user ever keeps more.
const LISTED = 500;

const key = (folder: string, conversation: string) =>
  `${folder}\n${conversation}`;

// Each folder's conversations, titled as the sidebar and command center name them.
async function titles(ctx: Pick<HostContext, "sessions">, folders: string[]) {
  const lists = await Promise.all(
    folders.map(async (f) => {
      const saved = await ctx.sessions.list(f).catch(() => []);
      return saved.map((c) => [key(f, c.id), c.title] as const);
    }),
  );
  return new Map(lists.flat());
}

const toProcedure = (m: Memory, named: Map<string, string>): Procedure => {
  const title = m.conversation
    ? named.get(key(m.folder, m.conversation))
    : undefined;
  return {
    id: m.id,
    title: m.title,
    steps: m.facts,
    folder: m.folder,
    at: m.createdAt,
    // A conversation that's gone can't be opened.
    ...(m.conversation &&
      title !== undefined && {
        from: { conversation: m.conversation, folder: m.folder, title },
      }),
  };
};

/** Every folder's procedures, newest first, each with the conversation it was learned in. */
export async function listProcedures(
  ctx: Pick<HostContext, "sessions">,
  db: DatabaseSync = memoryDb(),
): Promise<Procedure[]> {
  const found = withConcept(db, null, PROCEDURE, LISTED);
  const named = await titles(ctx, [...new Set(found.map((m) => m.folder))]);
  return found.map((m) => toProcedure(m, named));
}

/** Settings' procedures: list and remove. */
export const procedureHandlers = {
  procedures_list: (ctx: HostContext) => listProcedures(ctx),
  procedures_remove: (ctx: HostContext, r: { procedure: number }) => {
    const db = memoryDb();
    // Only a procedure, never another memory by its id.
    if (isProcedure(db, r.procedure)) removeMemory(db, r.procedure);
    return listProcedures(ctx, db);
  },
};
