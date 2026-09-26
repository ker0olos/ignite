import { useEffect, useState } from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import { ChevronRight } from "lucide-react";
import { highlight } from "@/lib/highlight";

const MAX_BYTES = 2_000_000;

type Loaded = { html: string } | { message: string };

async function load(path: string): Promise<Loaded> {
  const bytes = await readFile(path);
  if (bytes.length > MAX_BYTES)
    return { message: "File is too large to show." };
  if (bytes.subarray(0, 8000).includes(0)) {
    return { message: "Binary file not shown." };
  }
  return { html: await highlight(new TextDecoder().decode(bytes), path) };
}

/** Read-only, syntax-highlighted view of one file, with a breadcrumb. */
export function FileView({ path, root }: { path: string; root: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    load(path)
      .catch(() => ({ message: "Couldn't read this file." }))
      .then((result) => !cancelled && setLoaded(result));
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
