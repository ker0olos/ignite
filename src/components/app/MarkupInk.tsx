import { MARKUP_COLORS, MARKUP_SIZES, type MarkupSize } from "@/lib/markup";
import { cn } from "@/lib/utils";

const DOT: Record<MarkupSize, string> = {
  s: "size-1",
  m: "size-2",
  l: "size-3",
};
const SIZE_NAME: Record<MarkupSize, string> = {
  s: "Thin",
  m: "Medium",
  l: "Thick",
};

/** Ink colour and stroke size. */
export function MarkupInk({
  color,
  onColor,
  size,
  onSize,
}: {
  color: string;
  onColor: (color: string) => void;
  size: MarkupSize;
  onSize: (size: MarkupSize) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-1.5">
      <div className="flex items-center gap-1.5">
        {MARKUP_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Colour ${c}`}
            aria-pressed={c === color}
            onClick={() => onColor(c)}
            style={{ background: c }}
            className={cn(
              "size-4 rounded-full border border-border",
              c === color &&
                "ring-2 ring-ring ring-offset-1 ring-offset-popover",
            )}
          />
        ))}
      </div>
      <div className="flex items-center">
        {MARKUP_SIZES.map((s) => (
          <button
            key={s}
            type="button"
            aria-label={SIZE_NAME[s]}
            title={SIZE_NAME[s]}
            aria-pressed={s === size}
            onClick={() => onSize(s)}
            className={cn(
              "flex size-6 items-center justify-center rounded-md hover:bg-muted",
              s === size && "bg-secondary",
            )}
          >
            <span className={cn("rounded-full bg-foreground", DOT[s])} />
          </button>
        ))}
      </div>
    </div>
  );
}
