import { useEffect, useRef } from "react";
import type { useAgentSession } from "@/hooks/useAgentSession";
import type { Conversations } from "@/hooks/useConversations";
import { useOpenFile } from "@/hooks/useOpenFile";
import { useTabs } from "@/hooks/useTabs";
import { useTerminalTabs } from "@/hooks/useTerminalTabs";
import { childTabId } from "@/lib/childTabs";
import { worktreeCopy } from "@/lib/files";
import type { HostClient } from "@/lib/piHost";

/** `path` in the conversation's worktree, or the folder's own copy when the worktree has none (a file it doesn't track). */
async function inRoot(root: string, folder: string, path: string) {
  const own = `${folder}/${path}`;
  return root === folder
    ? own
    : ((await worktreeCopy(own, folder, root)) ?? own);
}

/**
 * Drops the tabs of a conversation that leaves its folder's list some other
 * way than the sidebar's Close (a task's, ended by the sidecar). Returns the
 * conversations being closed, which keep theirs until they did.
 */
function useForgetUnlisted(
  folders: string[],
  listed: (cwd: string) => { session: string }[],
  forget: (folder: string, session?: string) => void,
) {
  const closing = useRef(new Set<string>());
  const was = useRef<Record<string, string[]>>({});
  const now = JSON.stringify(
    Object.fromEntries(
      folders.map((f) => [f, listed(f).map((r) => r.session)]),
    ),
  );
  useEffect(() => {
    const lists = JSON.parse(now) as Record<string, string[]>;
    for (const [folder, before] of Object.entries(was.current)) {
      const list = lists[folder];
      // ponytail: a folder whose list empties keeps its tabs (it may be reloading); closing from the sidebar still drops them.
      if (!list?.length) continue;
      for (const s of before)
        if (!list.includes(s) && !closing.current.has(s)) forget(folder, s);
    }
    was.current = lists;
  }, [now, closing, forget]);
  return closing;
}

/**
 * The shown conversation's tabs and the folders' terminals, and opening a tab
 * in any folder or conversation. Closing a conversation (once it closed),
 * dismissing a folder, or a conversation leaving its folder's list drops its tabs.
 */
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
  const fileTabs = useTabs(current, session, agent.root);
  const terminals = useTerminalTabs(host, folders, {
    files: fileTabs.everyFile,
    close: fileTabs.close,
    closeEverywhere: fileTabs.closeEverywhere,
  });
  const tabs = { ...fileTabs, close: terminals.closeTab };
  const openIn = useOpenFile(
    current,
    { session: agent.session, root: agent.root },
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
    adopt(started.folder, started.session, started.workdir);
  }, [started, adopt]);
  const closing = useForgetUnlisted(folders, listed, forget);
  const isListed = (cwd: string, session: string) =>
    listed(cwd).some((r) => r.session === session);
  return {
    tabs,
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
      close: async (cwd: string, session: string, open: string[]) => {
        closing.current.add(session);
        const closed = await conversations.close(cwd, session, open);
        closing.current.delete(session);
        if (closed) forget(cwd, session);
        return closed;
      },
      dismiss: (cwd: string) => {
        forget(cwd);
        conversations.dismiss(cwd);
      },
    },
  };
}
