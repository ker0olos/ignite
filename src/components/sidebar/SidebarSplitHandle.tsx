import { ResizableHandle } from "@/components/ui/resizable";

/** Horizontal divider between stacked panes: the sidebar's conversations and files, the conversation and its docked tabs. */
export function SidebarSplitHandle() {
  return (
    <ResizableHandle className="transition-colors after:h-2 hover:bg-ring data-[separator=active]:bg-ring data-[separator=hover]:bg-ring" />
  );
}
