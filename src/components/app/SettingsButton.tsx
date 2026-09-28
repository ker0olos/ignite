import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens Settings; sits at the right of the title strip. */
export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label="Settings"
    >
      <Settings />
    </Button>
  );
}
