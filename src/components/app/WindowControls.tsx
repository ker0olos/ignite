import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { useMaximized } from "@/hooks/useMaximized";
import { cn } from "@/lib/utils";

const BUTTON =
  "flex w-11.5 items-center justify-center text-foreground/80 hover:bg-foreground/10 hover:text-foreground [&_svg]:size-4 [&_svg]:stroke-[1.25]";

/**
 * Windows' minimize, maximize and close in the window's top-right corner, as
 * VS Code and JetBrains draw them, since the window has no system title bar there.
 */
export function WindowControls() {
  const maximized = useMaximized();
  const win = getCurrentWindow();
  return (
    <div
      data-slot="window-controls"
      // Above dialogs' overlays: the window's only way to close or minimize.
      className="fixed top-0 right-0 z-60 flex h-9"
    >
      <button
        type="button"
        aria-label="Minimize"
        className={BUTTON}
        onClick={() => void win.minimize()}
      >
        <Minus />
      </button>
      <button
        type="button"
        aria-label={maximized ? "Restore" : "Maximize"}
        className={BUTTON}
        onClick={() => void win.toggleMaximize()}
      >
        {maximized ? <Copy /> : <Square />}
      </button>
      {/* Closing asks first, like every other way (lifecycle.ts). */}
      <button
        type="button"
        aria-label="Close"
        // White on red in every theme, like Windows' own close button.
        className={cn(BUTTON, "hover:bg-destructive hover:text-white")}
        onClick={() => void win.close()}
      >
        <X />
      </button>
    </div>
  );
}
