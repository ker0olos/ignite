import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowUpRight, Settings2 } from "lucide-react";
import type { MemoryStatus } from "../../../shared/memory";
import { ObservationRow } from "@/components/memory/ObservationRow";
import { Button } from "@/components/ui/button";
import { basename } from "@/lib/paths";

/** The open folder's latest memories, with links into cmem's viewer. */
export function MemoryPreview({
  folder,
  status: { observations, viewerUrl },
}: {
  folder: string | null;
  /** Shown while cmem runs, so `viewerUrl` is set. */
  status: MemoryStatus;
}) {
  // cmem's settings are a dialog inside its viewer, with no URL of their own.
  const openViewer = () => openUrl(viewerUrl ?? "").catch(() => {});
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">
        {folder ? `Recent memories in ${basename(folder)}` : "Recent memories"}
      </h3>
      <div className="overflow-hidden rounded-lg border bg-card">
        {observations.length ? (
          <ul className="divide-y">
            {observations.map((o) => (
              <ObservationRow key={o.id} observation={o} />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
            {folder
              ? "Nothing remembered for this folder yet. Memories appear here as the agent works."
              : "Open a folder to see what's remembered about it."}
          </p>
        )}
        <div className="flex items-center justify-end gap-1 border-t bg-muted/40 px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={openViewer}
          >
            <Settings2 />
            Configure
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={openViewer}
          >
            See all memories
            <ArrowUpRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
