import { ChevronDown, ChevronUp, KeyRound, X } from "lucide-react";
import type { FallbackKeyInfo } from "../../../shared/fallbackKeys";
import { Button } from "@/components/ui/button";
import { confirmNative } from "@/lib/lifecycle";

/** One saved fallback key: its last characters, and move and remove buttons. */
export function FallbackKeyRow({
  info,
  first,
  last,
  reorderable,
  onMove,
  onRemove,
}: {
  info: FallbackKeyInfo;
  first: boolean;
  last: boolean;
  reorderable: boolean;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5">
      <KeyRound className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px]">
          Anthropic API key ••••{info.hint}
        </span>
      </span>
      {reorderable && (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Move up"
            disabled={first}
            onClick={() => onMove(-1)}
          >
            <ChevronUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Move down"
            disabled={last}
            onClick={() => onMove(1)}
          >
            <ChevronDown />
          </Button>
        </>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Remove"
        onClick={() =>
          void confirmNative("Remove this fallback key?", "Remove").then(
            (ok) => ok && onRemove(),
          )
        }
      >
        <X />
      </Button>
    </div>
  );
}
