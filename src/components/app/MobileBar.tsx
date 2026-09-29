import { ArrowLeft, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A phone's top bar: opens the sidebar, and goes back from a file to the conversation. */
export function MobileBar({
  title,
  onMenu,
  onBack,
}: {
  title: string;
  onMenu: () => void;
  /** Set while a file covers the conversation. */
  onBack?: () => void;
}) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b px-1">
      <Button variant="ghost" size="icon" aria-label="Menu" onClick={onMenu}>
        <Menu />
      </Button>
      {onBack && (
        <Button variant="ghost" size="icon" aria-label="Back" onClick={onBack}>
          <ArrowLeft />
        </Button>
      )}
      <span className="min-w-0 truncate text-[13px] font-medium">{title}</span>
    </div>
  );
}
