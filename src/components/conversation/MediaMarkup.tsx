import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImageTarget } from "@/hooks/useImageTarget";

/** A generated image card's Mark up button; hidden with nowhere to send the marked-up image. */
export function MediaMarkup({ onClick }: { onClick: () => void }) {
  if (!useImageTarget()) return null;
  return (
    <Button
      size="xs"
      variant="ghost"
      className="text-[13px] text-muted-foreground"
      onClick={onClick}
    >
      <PenLine />
      Mark up
    </Button>
  );
}
