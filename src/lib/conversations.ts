import type { AgentStatus } from "../../shared/hostProtocol";
import type { SavedSession, SessionDetails } from "../../shared/conversations";

/** One conversation listed under its folder, running or not. */
type ListedConversation = { session: string; title: string };

/** Each folder's listed conversations, in the order they were opened. */
export type Listed = Record<string, ListedConversation[]>;

/**
 * Adds the running conversations the list doesn't have yet (the user just
 * started or reopened them) and takes their latest titles. Returns `listed`
 * itself when nothing changed.
 */
export function withRunning(listed: Listed, agents: AgentStatus[]): Listed {
  let next = listed;
  for (const { cwd, session, title } of agents) {
    const rows = next[cwd] ?? [];
    const row = rows.find((r) => r.session === session);
    if (row && (row.title === title || !title)) continue;
    const updated = row
      ? rows.map((r) => (r.session === session ? { session, title } : r))
      : [...rows, { session, title }];
    next = { ...next, [cwd]: updated };
  }
  return next;
}

/** Removes a conversation from its folder's list. */
export function without(listed: Listed, cwd: string, session: string): Listed {
  const rows = (listed[cwd] ?? []).filter((r) => r.session !== session);
  const rest = Object.fromEntries(
    Object.entries(listed).filter(([folder]) => folder !== cwd),
  );
  return rows.length ? { ...rest, [cwd]: rows } : rest;
}

/** A folder's listed conversations with what they're doing; one not running is idle. */
export function rowsOf(
  listed: Listed,
  agents: AgentStatus[],
  cwd: string,
): AgentStatus[] {
  return (listed[cwd] ?? []).map(({ session, title }) => {
    const running = agents.find((a) => a.session === session);
    return running
      ? { ...running, title: running.title || title }
      : { cwd, session, title, running: false, waiting: false };
  });
}

const MONEY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** A saved conversation's facts in one line: model, size, cost and branch, as far as they're known. */
export function detailsLine(saved: SavedSession, details: SessionDetails) {
  return [
    details.model,
    `${saved.messageCount} messages`,
    details.toolCalls ? `${details.toolCalls} tool calls` : null,
    details.cost ? MONEY.format(details.cost) : null,
    details.branch,
  ]
    .filter(Boolean)
    .join(" · ");
}
