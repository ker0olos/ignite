import { FileTab } from "@/components/app/FileTab";
import type { TabDragState } from "@/hooks/useTabDrag";
import type { TerminalLabel } from "@/lib/childTabs";
import { tabLabel } from "@/lib/diffTabs";
import type { Dock } from "@/lib/tabs";
import { cn } from "@/lib/utils";

/** A dock's tab strip: one tab per open file, diff, subagent or background command; tabs drag to reorder or to the other dock. */
export function FileTabs({
  files,
  active,
  folder,
  dock,
  drag,
  onSelect,
  onClose,
  terminalLabel,
}: {
  files: string[];
  active: string;
  folder: string;
  dock: Dock;
  drag?: TabDragState;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  terminalLabel?: (terminal: string) => TerminalLabel;
}) {
  const dragged = drag?.drag;
  const drop = dragged?.drop?.dock === dock ? dragged.drop.index : null;
  const side = dock === "side";
  return (
    <div
      data-tauri-drag-region={side || undefined}
      data-slot={side ? "file-tabs" : "docked-tabs"}
      className={cn(
        "flex shrink-0 flex-wrap items-end gap-0.5 border-b pr-2",
        // Beside the conversation, each wrapped row's tabs stretch to fill it.
        side
          ? "pt-4 pl-[max(0.5rem,var(--tabs-inset,0px))] *:grow"
          : "pt-2.5 pl-2",
      )}
    >
      {files.map((path, i) => (
        <FileTab
          key={path}
          path={path}
          label={tabLabel(path, folder, terminalLabel)}
          active={path === active}
          dragged={dragged?.tab === path}
          marker={
            drop === i
              ? "before"
              : drop === files.length && i === files.length - 1
                ? "after"
                : null
          }
          onPointerDown={(e) => drag?.start(path, e)}
          onSelect={() => onSelect(path)}
          onClose={() => onClose(path)}
        />
      ))}
    </div>
  );
}
