import { Bot, SquareTerminal, type LucideIcon } from "lucide-react";
import type { AgentStatus } from "../../shared/hostProtocol";

/** What a conversation runs beside it, opened as a tab: a subagent, or a background command. */
export type ChildTab =
  | { kind: "agent"; session: string; id: string; model: string }
  | { kind: "background"; session: string; pid: number; command: string };

const PREFIX = "child:";

/** Encodes a child tab as a tab id, distinct from file paths and diff tabs. */
export function childTabId(tab: ChildTab): string {
  return PREFIX + JSON.stringify(tab);
}

/** Decodes a tab id back to a child tab, or null for any other or malformed id. */
export function readChildTab(id: string): ChildTab | null {
  if (!id.startsWith(PREFIX)) return null;
  try {
    const tab = JSON.parse(id.slice(PREFIX.length)) as Partial<ChildTab>;
    if (typeof tab.session !== "string") return null;
    if (tab.kind === "agent" && typeof tab.id === "string") {
      return {
        kind: "agent",
        session: tab.session,
        id: tab.id,
        model: String(tab.model ?? ""),
      };
    }
    if (tab.kind === "background" && typeof tab.pid === "number") {
      const command = String(tab.command ?? "");
      return {
        kind: "background",
        session: tab.session,
        pid: tab.pid,
        command,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** How the tab strip shows a child tab. */
export function childTabLabel(tab: ChildTab): {
  name: string;
  detail: string;
  title: string;
  icon: LucideIcon;
} {
  return tab.kind === "agent"
    ? {
        name: tab.id,
        detail: tab.model,
        title: `Subagent ${tab.id}`,
        icon: Bot,
      }
    : {
        name: tab.command,
        detail: String(tab.pid),
        title: tab.command,
        icon: SquareTerminal,
      };
}

/** A conversation's subagents, then its background commands, each with its tab. */
export function childTabs(agent: AgentStatus) {
  const { session } = agent;
  const tabs: { tab: ChildTab; running: boolean }[] = [
    ...(agent.subagents ?? []).map(({ id, model, running }) => ({
      tab: { kind: "agent" as const, session, id, model },
      running,
    })),
    ...(agent.background ?? []).map(({ pid, command, running }) => ({
      tab: { kind: "background" as const, session, pid, command },
      running,
    })),
  ];
  return tabs.map(({ tab, running }) => ({
    id: childTabId(tab),
    tab,
    label: childTabLabel(tab),
    running,
  }));
}
