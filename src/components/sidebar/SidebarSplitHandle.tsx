import { ResizableHandle } from "@/components/ui/resizable";

/** Horizontal divider between sidebar conversations and files. */
export function SidebarSplitHandle() {
  return (
    <ResizableHandle className="transition-colors after:h-2 hover:bg-ring data-[separator=active]:bg-ring data-[separator=hover]:bg-ring" />
  );
}
