import { useEffect, useState } from "react";
import type { WorktreeLayout } from "../../shared/git";
import type { HostClient } from "@/lib/piHost";
import { cacheLayout, cachedLayout } from "@/lib/worktreeLayout";

/** Where `folder`'s conversations' worktrees are: the last known at once, read again from the sidecar; undefined until known. */
export function useWorktreeLayout(
  host: HostClient | null,
  folder: string | null,
) {
  const [read, setRead] = useState<Record<string, WorktreeLayout>>({});

  useEffect(() => {
    if (!host || !folder) return;
    let live = true;
    host
      .request({ type: "worktree_layout", cwd: folder })
      .then((layout) => {
        cacheLayout(folder, layout);
        if (live) setRead((all) => ({ ...all, [folder]: layout }));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [host, folder]);

  if (!folder) return undefined;
  return folder in read ? read[folder] : cachedLayout(folder);
}
