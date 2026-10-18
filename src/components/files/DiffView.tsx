import { useEffect, useRef, useState } from "react";
import { CommentableLines } from "@/components/files/CommentableLines";
import { ChangeNav } from "@/components/files/ChangeNav";
import { PathCrumbs } from "@/components/files/PathCrumbs";
import { useChangeNav } from "@/hooks/useChangeNav";
import { useDiffComments } from "@/hooks/useDiffComments";
import { rangeLabel, type DiffTab } from "@/lib/diffTabs";
import { parseUnifiedDiff } from "@/lib/gitDiff";
import type { HostClient } from "@/lib/piHost";
import type { CodeThemes } from "@/lib/codeThemes";
import type { Settings } from "@/lib/settings";

type Loaded =
  { lines: ReturnType<typeof parseUnifiedDiff> } | { message: string };

/** Read-only, syntax-highlighted view of one file's diff at some range, with a breadcrumb; its lines take comments for the conversation's message. */
export function DiffView({
  tab,
  host,
  themes,
  editor,
  shown,
}: {
  tab: DiffTab;
  host: HostClient | null;
  themes: CodeThemes;
  editor: Settings["editor"];
  /** The conversation shown, which a diff no conversation opened comments to. */
  shown: string | null;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const changes = useChangeNav(
    loaded && "lines" in loaded ? loaded.lines : null,
    scroller,
  );
  const comments = useDiffComments(tab, shown);

  useEffect(() => {
    if (!host) return;
    let cancelled = false;
    host
      .request({
        type: "git_diff",
        repo: tab.repo,
        range: tab.range,
        path: tab.path,
      })
      .then((diff) => {
        if (cancelled) return;
        const lines = parseUnifiedDiff(diff);
        setLoaded(lines.length ? { lines } : { message: "No changes." });
      })
      .catch((e: Error) => !cancelled && setLoaded({ message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [host, tab.repo, tab.range, tab.path]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex h-8 shrink-0 items-center gap-1 pr-2 pl-4 text-xs text-muted-foreground">
        <PathCrumbs path={tab.path} />
        <span className="min-w-0 truncate">({rangeLabel(tab.range)})</span>
        {changes.count > 0 && <ChangeNav onStep={changes.go} />}
      </nav>
      {loaded && "message" in loaded ? (
        <p className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
          {loaded.message}
        </p>
      ) : (
        <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
          {loaded && (
            <CommentableLines
              lines={loaded.lines}
              path={tab.path}
              comments={comments}
              editor={editor}
              themes={themes}
            />
          )}
        </div>
      )}
    </div>
  );
}
