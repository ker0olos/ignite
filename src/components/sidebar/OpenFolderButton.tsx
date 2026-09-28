import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens a folder from the sidebar's title strip, shown only in projects mode. */
export function OpenFolderButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label="Open Folder"
      title="Open Folder (⌘O)"
    >
      <FolderPlus />
    </Button>
  );
}
