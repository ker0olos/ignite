import { ToolGlyph } from "@/components/conversation/ToolGlyph";
import {
  BADGE_CLASSES,
  GLYPH_BADGE_CLASSES,
  type ToolBadge,
} from "@/lib/toolLabels";
import { tileClass, type ToolIcon } from "@/lib/toolIcon";
import { cn } from "@/lib/utils";

/** A tool call's 30px tile: its icon, and a badge on the corner while it runs, waits or failed; a built-in tool's glyph stands alone, coloured by the badge. */
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
  const plain = icon.kind === "lucide" && icon.plain;
  return (
    <span
      className={cn(
        "relative z-[1] flex size-[30px] shrink-0 items-center justify-center rounded-[8px]",
        plain
          ? [
              // The page's colour hides a script's line behind the glyph.
              "bg-background text-muted-foreground",
              badge && GLYPH_BADGE_CLASSES[badge],
            ]
          : ["border border-border", tileClass(icon)],
        dim && "opacity-45",
      )}
      style={brand ? { background: icon.hex } : undefined}
    >
      <ToolGlyph icon={icon} />
      {badge && !plain && (
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
