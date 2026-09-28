import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { CodeLines } from "@/components/conversation/CodeLines";
import { ChangeNav } from "@/components/files/ChangeNav";
import { useChangeNav } from "@/hooks/useChangeNav";
import { rangeLabel, type DiffTab } from "@/lib/diffTabs";
import { parseUnifiedDiff } from "@/lib/gitDiff";
import type { HostClient } from "@/lib/piHost";
import type { CodeThemes } from "@/lib/codeThemes";
import type { Settings } from "@/lib/settings";

type Loaded =
  { lines: ReturnType<typeof parseUnifiedDiff> } | { message: string };

/** Read-only, syntax-highlighted view of one file's diff at some range, with a breadcrumb. */
export function DiffView({
  tab,
  host,
  themes,
  editor,
}: {
  tab: DiffTab;
  host: HostClient | null;
  themes: CodeThemes;
  editor: Settings["editor"];
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const changes = useChangeNav(
    loaded && "lines" in loaded ? loaded.lines : null,
    scroller,
  );

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

  const crumbs = tab.path.split("/");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex h-8 shrink-0 items-center gap-1 pr-2 pl-4 text-xs text-muted-foreground">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3" />}
            <span className={i === crumbs.length - 1 ? "text-foreground" : ""}>
              {crumb}
            </span>
          </span>
        ))}
        <span>({rangeLabel(tab.range)})</span>
        {changes.count > 0 && <ChangeNav onStep={changes.go} />}
      </nav>
      {loaded && "message" in loaded ? (
        <p className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
          {loaded.message}
        </p>
      ) : (
        <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
          {loaded && (
            <CodeLines
              lines={loaded.lines}
              path={tab.path}
              max={Infinity}
              editor={editor}
              codeThemes={themes}
              className="rounded-none border-0"
            />
          )}
        </div>
      )}
    </div>
  );
}
