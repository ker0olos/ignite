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
    // A <button> is always an atomic box, so a long link couldn't wrap as a pill per line.
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        if (window.getSelection()?.isCollapsed === false) return;
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) onOpen();
      }}
      className={cn(
        "inline cursor-pointer rounded-full border border-foreground/25 px-2 text-[0.88em] [overflow-wrap:anywhere] box-decoration-clone hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
        kind === "file" && "font-mono",
      )}
    >
      {children}
      <Arrow
        aria-hidden
        className="ml-1 inline size-[0.9em] align-[-0.1em] opacity-60"
      />
    </span>
  );
}
