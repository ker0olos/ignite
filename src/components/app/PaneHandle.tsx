import { ResizableHandle } from "@/components/ui/resizable";

/** A 1px divider with a wider grab area that lights up on hover, like VS Code's sashes. */
export function PaneHandle({
  onPointerDown,
  onKeyDown,
}: {
  onPointerDown?: () => void;
  onKeyDown?: () => void;
}) {
  return (
    <ResizableHandle
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      // The border color is translucent; over Liquid Glass the wallpaper would show through it.
      className="bg-background shadow-[inset_1px_0_var(--border)] transition-colors after:w-2 hover:bg-ring data-[separator=active]:bg-ring data-[separator=hover]:bg-ring"
    />
  );
}
