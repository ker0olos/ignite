import { Check } from "lucide-react";
import type { ToolIcon } from "@/lib/toolIcon";
import { cn } from "@/lib/utils";

/** The mark drawn in a tool tile. */
export function ToolGlyph({ icon }: { icon: ToolIcon }) {
  if (icon.kind === "done") {
    return <Check aria-hidden strokeWidth={3} className="size-[15px]" />;
  }
  if (icon.kind === "lucide") {
    const Icon = icon.icon;
    return (
      <Icon
        aria-hidden
        className={cn(
          icon.plain ? "size-4" : "size-[15px]",
          !icon.color && !icon.plain && "text-foreground/85",
        )}
        style={{ color: icon.color }}
      />
    );
  }
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={cn(
        "size-[15px]",
        icon.tone === "brand" && "fill-white",
        icon.tone === "inverse" && "fill-primary-foreground",
      )}
      style={icon.tone === "card" ? { fill: icon.hex } : undefined}
    >
      <path d={icon.path} />
    </svg>
  );
}
