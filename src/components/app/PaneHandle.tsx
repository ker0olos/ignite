import { ResizableHandle } from "@/components/ui/resizable";

/** A 1px divider with a wider grab area that lights up on hover, like VS Code's sashes. */
export function PaneHandle() {
  return (
    <ResizableHandle className="transition-colors after:w-2 hover:bg-ring data-[separator=active]:bg-ring data-[separator=hover]:bg-ring" />
  );
}
