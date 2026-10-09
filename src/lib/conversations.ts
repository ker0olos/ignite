import type { AgentStatus } from "../../shared/hostProtocol";
import type { SavedSession, SessionDetails } from "../../shared/conversations";
import { normalizedTags, type ConversationTags } from "./conversationTags";
import type { ConversationOrder } from "./settings";

/** One conversation listed under its folder, running or not; a fork under its original. */
type ListedConversation = { session: string; title: string; forkOf?: string };

/** A sidebar conversation row, including app-local tags and its forks. */
export type TaggedAgentStatus = AgentStatus & {
  tags?: string[];
  forks?: AgentStatus[];
};

/** Each folder's listed conversations, in the order they were opened. */
export type Listed = Record<string, ListedConversation[]>;

// A known title is kept over none; null when `row` already says it all.
function asListed(
  { session, title, forkOf }: AgentStatus,
  row?: ListedConversation,
): ListedConversation | null {
  const same = row?.forkOf === forkOf;
  if (row && same && (row.title === title || !title)) return null;
  return {
    session,
    title: title || row?.title || "",
    ...(forkOf && { forkOf }),
  };
}

/**
 * Adds the running conversations the list doesn't have yet (the user just
 * started or reopened them) and takes their latest titles. Returns `listed`
 * itself when nothing changed.
 */
export function withRunning(listed: Listed, agents: AgentStatus[]): Listed {
  let next = listed;
  for (const agent of agents) {
    const rows = next[agent.cwd] ?? [];
    const row = rows.find((r) => r.session === agent.session);
    const listedRow = asListed(agent, row);
    if (!listedRow) continue;
    const updated = row
      ? rows.map((r) => (r === row ? listedRow : r))
      : [...rows, listedRow];
    next = { ...next, [agent.cwd]: updated };
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
  tags: ConversationTags = {},
  tagFilter: readonly string[] = [],
): TaggedAgentStatus[] {
  const selected = new Set(tagFilter);
  const listedHere = listed[cwd] ?? [];
  const row = ({ session, title }: ListedConversation): AgentStatus => {
    const running = agents.find((a) => a.session === session);
    return running
      ? { ...running, title: running.title || title }
      : { cwd, session, title, running: false, waiting: false };
  };
  // A fork whose original was closed is listed on its own.
  const nested = (forkOf?: string) =>
    !!forkOf && listedHere.some((r) => r.session === forkOf);
  return listedHere
    .filter(
      ({ session, forkOf }) =>
        !nested(forkOf) &&
        (!selected.size || tags[session]?.some((tag) => selected.has(tag))),
    )
    .map((listed) => {
      const forks = listedHere.filter((f) => f.forkOf === listed.session);
      return {
        ...row(listed),
        tags: tags[listed.session],
        ...(forks.length && { forks: forks.map(row) }),
      };
    });
}

/** Every tag used by the conversations currently listed. */
export function allTags(listed: Listed, tags: ConversationTags) {
  return normalizedTags(
    Object.values(listed).flatMap((rows) =>
      rows.flatMap((r) => tags[r.session] ?? []),
    ),
  );
}

/** Returns rows in the selected sidebar conversation order. */
export function orderedRows(
  rows: AgentStatus[],
  order: ConversationOrder,
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
