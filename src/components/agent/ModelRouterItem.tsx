import { Check } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/** The model menu's first item: turns Model Router on, with a check while it is. */
export function ModelRouterItem({
  modelRouter,
  onModelRouter,
}: {
  modelRouter: boolean;
  onModelRouter: (on: boolean) => void;
}) {
  return (
    <>
      <DropdownMenuItem onClick={() => onModelRouter(true)}>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px]">Router</span>
          <span className="truncate text-xs text-muted-foreground">
            Picks the model for a new conversation
          </span>
        </div>
        {modelRouter && <Check className="size-4" />}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </>
  );
}
