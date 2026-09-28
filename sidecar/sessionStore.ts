import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { SessionStore } from "./hostTypes.ts";

// pi writes a new conversation only once it has a reply; this one is written
// now, so reopening the folder continues it rather than the one before it.
/** Opens the folder's saved conversation `id`, or starts one with that id. */
export function sessionFor(cwd: string, id: string) {
  const saved = SessionManager.findById(cwd, id);
  if (saved) return SessionManager.open(saved, undefined, cwd);
  const created = SessionManager.create(cwd, undefined, { id });
  const file = created.getSessionFile()!;
  writeFileSync(file, `${JSON.stringify(created.getHeader())}\n`);
  return SessionManager.open(file, undefined, cwd);
}

/** pi's saved conversations, one file each under the agent dir's sessions/. */
export const sessions: SessionStore = {
  // ponytail: parses the newest file, which opening it parses again.
  latest: (cwd) => SessionManager.continueRecent(cwd).getSessionId(),
  create: () => randomUUID(),
  list: async (cwd) =>
    (await SessionManager.list(cwd))
      .filter((s) => s.messageCount > 0)
      .map((s) => ({
        id: s.id,
        title: s.name ?? s.firstMessage,
        modified: s.modified.getTime(),
        messageCount: s.messageCount,
      })),
};
