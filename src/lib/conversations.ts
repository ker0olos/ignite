import type { AgentStatus } from "../../shared/hostProtocol";
import type { SavedSession, SessionDetails } from "../../shared/conversations";
import type { ChatOrder } from "./settings";

/** One conversation listed under its folder, running or not. */
type ListedConversation = { session: string; title: string; tags?: string[] };

/** A sidebar conversation row, including app-local tags. */
export type TaggedAgentStatus = AgentStatus & { tags?: string[] };

/** Each folder's listed conversations, in the order they were opened. */
export type Listed = Record<string, ListedConversation[]>;

const normalizedTags = (tags: readonly string[]) =>
  Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

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
      ? rows.map((r) => (r.session === session ? { ...r, title } : r))
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
  tagFilter: readonly string[] = [],
): TaggedAgentStatus[] {
  const selected = new Set(tagFilter);
  return (listed[cwd] ?? [])
    .filter(
      (row) => !selected.size || row.tags?.some((tag) => selected.has(tag)),
    )
    .map(({ session, title, tags }) => {
      const running = agents.find((a) => a.session === session);
      return running
        ? { ...running, title: running.title || title, tags }
        : { cwd, session, title, running: false, waiting: false, tags };
    });
}

/** Saves a conversation's tag list, creating the row if needed. */
export function withTags(
  listed: Listed,
  cwd: string,
  session: string,
  tags: readonly string[],
): Listed {
  const rows = listed[cwd] ?? [];
  const nextTags = normalizedTags(tags);
  const found = rows.some((r) => r.session === session);
  const updated = found
    ? rows.map((r) => (r.session === session ? { ...r, tags: nextTags } : r))
    : [...rows, { session, title: "", tags: nextTags }];
  return { ...listed, [cwd]: updated };
}

/** Every tag used by the listed conversations. */
export function allTags(listed: Listed) {
  return normalizedTags(
    Object.values(listed).flatMap((rows) => rows.flatMap((r) => r.tags ?? [])),
  );
}

/** Returns rows in the selected sidebar conversation order. */
export function orderedRows(
  rows: AgentStatus[],
  order: ChatOrder,
): AgentStatus[] {
  return order === "newest_first" ? [...rows].reverse() : rows;
}

const MONEY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** A saved conversation's facts in one line: model, size, cost and branch, as far as they're known. */
export function detailsLine(
  saved: Pick<SavedSession, "messageCount">,
  details: SessionDetails,
) {
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
