import { useEffect, useState } from "react";
import { PathCrumbs } from "@/components/files/PathCrumbs";
import { readForView, type FileContent } from "@/lib/files";
import type { CodeThemes } from "@/lib/codeThemes";
import type { Settings } from "@/lib/settings";
import { cn } from "@/lib/utils";

/** Read-only, syntax-highlighted view of one file, with a breadcrumb. */
export function FileView({
  path,
  root,
  themes,
  editor,
  lines,
}: {
  path: string;
  root: string;
  themes: CodeThemes;
  editor: Settings["editor"];
  /** Show only the first this many lines. */
  lines?: number;
}) {
  const [loaded, setLoaded] = useState<FileContent | null>(null);
  const { light, dark } = themes;

  useEffect(() => {
    let cancelled = false;
    readForView(path, { light, dark }, lines).then(
      (result) => !cancelled && setLoaded(result),
    );
    return () => {
      cancelled = true;
    };
  }, [path, light, dark, lines]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex h-7 shrink-0 items-center gap-1 px-4 text-xs text-muted-foreground">
        <PathCrumbs path={path.slice(root.length + 1)} />
      </nav>
      {loaded && "message" in loaded ? (
        <p className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
          {loaded.message}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overscroll-contain overflow-auto">
          <div
            className={cn(
              "code-view always-bounce pb-8 select-text",
              editor.word_wrap && "wrap",
            )}
            style={{ fontFamily: editor.font_family }}
            // Shiki escapes the file's contents; the markup is its own.
            dangerouslySetInnerHTML={{ __html: loaded?.html ?? "" }}
          />
        </div>
      )}
    </div>
  );
}
