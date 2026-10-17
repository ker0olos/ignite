import { Bot, SquareTerminal, type LucideIcon } from "lucide-react";
import type { AgentStatus } from "../../shared/hostProtocol";

/** What a conversation runs beside it, opened as a tab: a subagent, or a background command. */
export type ChildTab =
  | { kind: "agent"; session: string; id: string; model: string }
  | { kind: "background"; session: string; pid: number; command: string }
  | { kind: "terminal"; session: string; terminal: string };

const PREFIX = "child:";

/** Encodes a child tab as a tab id, distinct from file paths and diff tabs. */
export function childTabId(tab: ChildTab): string {
  return PREFIX + JSON.stringify(tab);
}

/** Decodes a tab id back to a child tab, or null for any other or malformed id. */
export function readChildTab(id: string): ChildTab | null {
  const tab = parse(id);
  if (!tab) return null;
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
    return { kind: "background", session: tab.session, pid: tab.pid, command };
  }
  if (tab.kind === "terminal" && typeof tab.terminal === "string") {
    return { kind: "terminal", session: tab.session, terminal: tab.terminal };
  }
  return null;
}

function parse(id: string): (Partial<ChildTab> & { session: string }) | null {
  if (!id.startsWith(PREFIX)) return null;
  try {
    const tab = JSON.parse(id.slice(PREFIX.length)) as Partial<ChildTab>;
    return typeof tab.session === "string"
      ? { ...tab, session: tab.session }
      : null;
  } catch {
    return null;
  }
}

/** The terminal a tab id shows, or null for any other tab. */
export function terminalOf(id: string): string | null {
  const tab = readChildTab(id);
  return tab?.kind === "terminal" ? tab.terminal : null;
}

/** A terminal as its tab and sidebar row show it: its name (t1) and the command running in it. */
export type TerminalLabel = { name?: string; command?: string };

/** A terminal's title: the command running in it, else "Terminal 1". */
export const terminalTitle = ({ name, command }: TerminalLabel) =>
  command ?? (name ? `Terminal ${name.slice(1)}` : "Terminal");

/** How the tab strip shows a child tab; a terminal by the command running in it, if one is. */
export function childTabLabel(
  tab: ChildTab,
  terminal?: (terminal: string) => TerminalLabel,
): { name: string; detail: string; title: string; icon: LucideIcon } {
  if (tab.kind === "terminal") {
    const label = terminal?.(tab.terminal) ?? {};
    const title = terminalTitle(label);
    return {
      name: title,
      detail: label.name ?? "",
      title,
      icon: SquareTerminal,
    };
  }
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
