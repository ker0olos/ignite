import { useState } from "react";
import { EllipsisVertical, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClearConversationDialog } from "@/components/agent/ClearConversationDialog";

/** "⋯" menu above the conversation: clear the folder's saved history. */
export function ConversationMenu({
  folder,
  running,
  onClear,
}: {
  folder: string;
  running: boolean;
  onClear: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Conversation options"
          className="absolute top-2 right-2 z-10 flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
        >
          <EllipsisVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom" className="w-56">
          <DropdownMenuItem
            variant="destructive"
            disabled={running}
            onClick={() => setConfirming(true)}
          >
            <Trash2 />
            Clear conversation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ClearConversationDialog
        folder={folder}
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() => {
          setConfirming(false);
          onClear();
        }}
      />
    </>
  );
}
