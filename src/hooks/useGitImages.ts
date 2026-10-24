import { useEffect, useState } from "react";
import type { ImageContent } from "../../shared/agentTypes";
import type { DiffTab } from "@/lib/diffTabs";
import type { HostClient } from "@/lib/piHost";

type Shown =
  { before: ImageContent; after: ImageContent } | { message: string } | null;

/** An image diff tab's two versions; a new or deleted image is compared with itself, as under a bash call. */
export function useGitImages(tab: DiffTab, host: HostClient | null): Shown {
  const [shown, setShown] = useState<Shown>(null);
  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    host
      .request({
        type: "git_image",
        repo: tab.repo,
        range: tab.range,
        path: tab.path,
      })
      .then(({ before, after }) => {
        if (cancelled) return;
        // Only an added or deleted image lacks a side; a changed one lacks it when it's too large.
        const was = tab.status === "A" ? after : before;
        const now = tab.status === "D" ? before : after;
        setShown(
          was && now
            ? { before: was, after: now }
            : { message: "Too large to show." },
        );
      })
      .catch((e: Error) => !cancelled && setShown({ message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [host, tab.repo, tab.range, tab.path, tab.status]);
  return shown;
}
