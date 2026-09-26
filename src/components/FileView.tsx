import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { readForView, type FileContent } from "@/lib/files";

/** Read-only, syntax-highlighted view of one file, with a breadcrumb. */
export function FileView({ path, root }: { path: string; root: string }) {
  const [loaded, setLoaded] = useState<FileContent | null>(null);

  useEffect(() => {
    let cancelled = false;
    readForView(path).then((result) => !cancelled && setLoaded(result));
    return () => {
      cancelled = true;
    };
  }, [path]);

  const crumbs = path.slice(root.length + 1).split("/");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex h-7 shrink-0 items-center gap-1 px-4 text-xs text-muted-foreground">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3" />}
            <span className={i === crumbs.length - 1 ? "text-foreground" : ""}>
              {crumb}
            </span>
          </span>
        ))}
      </nav>
      {loaded && "message" in loaded ? (
        <p className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
          {loaded.message}
        </p>
      ) : (
        <div
          className="code-view min-h-0 flex-1 overflow-auto pb-8 font-mono text-xs select-text"
          // Shiki escapes the file's contents; the markup is its own.
          dangerouslySetInnerHTML={{ __html: loaded?.html ?? "" }}
        />
      )}
    </div>
  );
}
