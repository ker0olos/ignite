import type { Mark } from "@/components/mcp/marks";
import { cn } from "@/lib/utils";

/** Renders a mark's icon, tinted with its brand colour or the text colour. */
export function Glyph({ mark, className }: { mark: Mark; className?: string }) {
  const style = { color: mark.color };
  const classes = cn(
    "size-4 shrink-0",
    !mark.color && "text-foreground",
    className,
  );
  if (!("path" in mark.icon)) {
    const Lucide = mark.icon;
    return <Lucide className={classes} style={style} />;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={classes}
      style={style}
    >
      <title>{mark.icon.title}</title>
      <path d={mark.icon.path} />
    </svg>
  );
}
