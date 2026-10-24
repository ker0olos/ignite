import { ToolGlyph } from "@/components/conversation/ToolGlyph";
import { BADGE_CLASSES, type ToolBadge } from "@/lib/toolLabels";
import type { ToolIcon } from "@/lib/toolIcon";
import { cn } from "@/lib/utils";

/** A tool call's 30px tile: its icon, and a badge on the corner while it runs, waits or failed. */
export function ToolTile({
  icon,
  badge,
  dim,
}: {
  icon: ToolIcon;
  badge?: ToolBadge | null;
  dim?: boolean;
}) {
  const brand = icon.kind === "brand" && icon.tone === "brand";
  return (
    <span
      className={cn(
        "relative z-[1] flex size-[30px] shrink-0 items-center justify-center rounded-[8px] border border-border",
        icon.kind === "done" && "border-success bg-success text-background",
        icon.kind === "lucide" && "bg-muted",
        icon.kind === "brand" &&
          {
            brand: "",
            inverse: "bg-primary",
            card: "bg-card",
          }[icon.tone],
        dim && "opacity-45",
      )}
      style={brand ? { background: icon.hex } : undefined}
    >
      <ToolGlyph icon={icon} />
      {badge && (
        <span
          className={cn(
            "absolute -right-[3px] -bottom-[3px] size-2.5 rounded-full ring-2 ring-background",
            BADGE_CLASSES[badge],
          )}
        />
      )}
    </span>
  );
}
