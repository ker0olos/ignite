import { ImageCompare } from "@/components/conversation/ImageCompare";
import { PathCrumbs } from "@/components/files/PathCrumbs";
import { useGitImages } from "@/hooks/useGitImages";
import { rangeLabel, type DiffTab } from "@/lib/diffTabs";
import type { HostClient } from "@/lib/piHost";

/** An image's diff tab: its versions before and after the range, split by a dragged line. */
export function ImageDiffView({
  tab,
  host,
}: {
  tab: DiffTab;
  host: HostClient | null;
}) {
  const shown = useGitImages(tab, host);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex h-8 shrink-0 items-center gap-1 pr-2 pl-4 text-xs text-muted-foreground">
        <PathCrumbs path={tab.path} />
        <span className="min-w-0 truncate">({rangeLabel(tab.range)})</span>
      </nav>
      {shown && "message" in shown ? (
        <p className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
          {shown.message}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
          {shown && <ImageCompare {...shown} name={tab.path} wide />}
        </div>
      )}
    </div>
  );
}
