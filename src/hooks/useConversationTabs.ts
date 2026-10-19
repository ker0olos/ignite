import { useEffect, useRef } from "react";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { Conversations } from "@/hooks/useConversations";
import { useOpenFile } from "@/hooks/useOpenFile";
import { useTabs } from "@/hooks/useTabs";
import { useTerminalTabs } from "@/hooks/useTerminalTabs";
import { useWorktreeLayout } from "@/hooks/useWorktreeLayout";
import { childTabId } from "@/lib/childTabs";
import { worktreeCopy } from "@/lib/files";
import type { HostClient } from "@/lib/piHost";
import { conversationRoot } from "@/lib/worktreeLayout";

/** `path` in the conversation's worktree, or the folder's own copy when the worktree has none (a file it doesn't track). */
async function inRoot(root: string, folder: string, path: string) {
  const own = `${folder}/${path}`;
  return root === folder
    ? own
    : ((await worktreeCopy(own, folder, root)) ?? own);
}

/** Drops the tabs of a conversation that leaves its folder's list (closed anywhere, a task's ended by the sidecar). */
function useForgetUnlisted(
  folders: string[],
  listed: (cwd: string) => { session: string }[],
  forget: (folder: string, session?: string) => void,
) {
  const was = useRef<Record<string, string[]>>({});
  // One line per folder: its path, a tab, its conversations; an effect reads it only when it changes.
  const now = folders
    .map(
      (f) =>
        `${f}\t${listed(f)
          .map((r) => r.session)
          .join(" ")}`,
    )
    .join("\n");
  useEffect(() => {
    const lists: Record<string, string[]> = Object.fromEntries(
      now
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [folder, sessions] = line.split("\t");
          return [folder, sessions ? sessions.split(" ") : []];
        }),
    );
    for (const [folder, before] of Object.entries(was.current)) {
      const list = lists[folder];
      // ponytail: a folder whose list empties keeps its tabs (it may be reloading); closing from the sidebar still drops them.
      if (!list?.length) continue;
      for (const s of before) if (!list.includes(s)) forget(folder, s);
    }
    was.current = lists;
  }, [now, forget]);
}

/** The shown conversation's tabs, root and terminals, and opening a tab in any folder or conversation. */
export function useConversationTabs(
  host: HostClient | null,
  current: string | null,
  folders: string[],
  agent: ReturnType<typeof useAgentSession>,
  conversations: Conversations,
  select: (folder: string) => void,
  /** A folder's listed (open) conversations. */
  listed: (cwd: string) => { session: string }[],
) {
  // Unknown (undefined) until the folder shows a conversation, or none yet (null).
  const session = agent.session ?? (agent.none ? null : undefined);
  const layout = useWorktreeLayout(host, current);
  const root = conversationRoot(current, session, agent.workdir, layout);
  const fileTabs = useTabs(current, session);
  const terminals = useTerminalTabs(host, folders, {
    files: fileTabs.terminalTabs,
    close: fileTabs.close,
    closeEverywhere: fileTabs.closeEverywhere,
  });
  const tabs = { ...fileTabs, close: terminals.closeTab };
  const openIn = useOpenFile(
    current,
    { session: agent.session, root },
    tabs.open,
    select,
  );
  const { forget, adopt, ownerOf } = fileTabs;
  const { started } = agent;
  // The tabs opened before the first message stay with the conversation it
  // starts, once: an effect run again (dev, hot reload) would hand the next
  // new conversation's tabs to this one.
  const adopted = useRef<string | null>(null);
  useEffect(() => {
    if (!started || adopted.current === started.session) return;
    adopted.current = started.session;
    const ready = host
      ?.request({ type: "worktree_ready", session: started.session })
      .catch(() => {});
    adopt(started.folder, started.session, started.workdir, ready);
  }, [started, adopt, host]);
  useForgetUnlisted(folders, listed, forget);
  const isListed = (cwd: string, session: string) =>
    listed(cwd).some((r) => r.session === session);
  return {
    tabs,
    /** The shown conversation (null before a first message, undefined while unknown) and where its files are (null while unknown). */
    shown: { session, root },
    terminals,
    openIn,
    /** Opens a file the command center found in `folder` (relative `path`), from the shown conversation's worktree. */
    openFile: (folder: string, path: string) =>
      openIn(folder, (r) => inRoot(r, folder, path)),
    /** Opens a terminal's tab in the conversation that has it, showing that conversation; else in the shown one. */
    openTerminal: (cwd: string, terminal: string) => {
      const tab = childTabId({ kind: "terminal", session: "", terminal });
      const owner = ownerOf(tab);
      if (!owner || owner === agent.session || !isListed(cwd, owner))
        return openIn(cwd, tab);
      conversations.show(cwd, owner);
      openIn(cwd, tab, owner);
    },
    conversations: {
      ...conversations,
      // Closing leaves the sidebar at once, its tabs with it, whether or not the sidecar manages to.
      close: (cwd: string, session: string, open: string[]) => {
        forget(cwd, session);
        return conversations.close(cwd, session, open);
      },
      dismiss: (cwd: string) => {
        forget(cwd);
        conversations.dismiss(cwd);
      },
    },
  };
}
