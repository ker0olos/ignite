import { ChevronRight } from "lucide-react";

/** A relative path as breadcrumbs on one line, each part truncated when space runs out. */
export function PathCrumbs({ path }: { path: string }) {
  const crumbs = path.split("/");
  return crumbs.map((crumb, i) => (
    <span key={i} className="flex min-w-0 items-center gap-1">
      {i > 0 && <ChevronRight className="size-3 shrink-0" />}
      <span
        className={
          i === crumbs.length - 1 ? "truncate text-foreground" : "truncate"
        }
      >
        {crumb}
      </span>
    </span>
  ));
}
