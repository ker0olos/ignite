import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Previous and next change buttons for a diff, as in VS Code. */
export function ChangeNav({ onStep }: { onStep: (step: 1 | -1) => void }) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5">
      <Button
        size="icon-xs"
        variant="ghost"
        title="Previous Change (⇧⌥F5)"
        aria-label="Previous change"
        onClick={() => onStep(-1)}
      >
        <ArrowUp />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        title="Next Change (⌥F5)"
        aria-label="Next change"
        onClick={() => onStep(1)}
      >
        <ArrowDown />
      </Button>
    </div>
  );
}
