import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A centered pill that shows `count` more rows of a group: "Show 9", then "Show 10 more". */
export function ShowMoreButton({
  count,
  more,
  onClick,
}: {
  count: number;
  /** Some rows already show. */
  more: boolean;
  onClick: () => void;
}) {
  return (
    <div className="mt-3 flex justify-center">
      <Button
        size="sm"
        variant="outline"
        className="rounded-full px-4 text-[13px] text-muted-foreground"
        onClick={onClick}
      >
        {more ? `Show ${count} more` : `Show ${count}`}
        <ChevronDown />
      </Button>
    </div>
  );
}
