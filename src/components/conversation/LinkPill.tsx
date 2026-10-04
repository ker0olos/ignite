import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A link in assistant text: a file (opens a tab, →) or a URL (leaves the app, ↗). */
export function LinkPill({
  kind,
  onOpen,
  children,
}: {
  kind: "file" | "url";
  onOpen: () => void;
  children: ReactNode;
}) {
  const Arrow = kind === "file" ? ArrowRight : ArrowUpRight;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "inline cursor-pointer rounded-full border border-foreground/25 px-2 text-left text-[0.88em] [overflow-wrap:anywhere] [box-decoration-break:clone] hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
        kind === "file" && "font-mono",
      )}
    >
      {children}
      <Arrow
        aria-hidden
        className="ml-1 inline size-[0.9em] align-[-0.1em] opacity-60"
      />
    </button>
  );
}
