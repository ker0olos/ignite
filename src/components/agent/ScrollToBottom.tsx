import { ArrowDown } from "lucide-react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { useScrolledUp } from "@/hooks/useScrolledUp";

/** Floats above the composer once scrolled a screen up; jumps the conversation to its newest rows. */
export function ScrollToBottom({
  scrollRef,
  contentRef,
  onClick,
}: {
  scrollRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  onClick: () => void;
}) {
  if (!useScrolledUp(scrollRef, contentRef)) return null;
  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label="Scroll to bottom"
      onClick={onClick}
      className="absolute right-4 bottom-3 rounded-full bg-background shadow-sm"
    >
      <ArrowDown />
    </Button>
  );
}
