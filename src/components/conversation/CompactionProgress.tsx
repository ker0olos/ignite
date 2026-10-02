import { useSpinnerFrame } from "@/hooks/useSpinnerFrame";
import { summaryProgress, tokenCount } from "@/lib/compaction";

/** Compaction at work, like the working line, with a bar that fills as the summary is written. */
export function CompactionProgress({ written }: { written?: number }) {
  const frame = useSpinnerFrame();
  const fill = `${Math.round(summaryProgress(written) * 100)}%`;
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="font-mono">{frame}</span>
      <span className="font-mono">Compacting the conversation</span>
      <span
        role="progressbar"
        aria-label="Compacting the conversation"
        aria-valuenow={Math.round(summaryProgress(written) * 100)}
        className="ml-1 h-1 w-32 overflow-hidden rounded-full bg-muted"
      >
        <span
          className="block h-full rounded-full bg-muted-foreground transition-[width] duration-300"
          style={{ width: fill }}
        />
      </span>
      {!!written && (
        <span className="shrink-0 text-muted-foreground/70 tabular-nums">
          {tokenCount(written)} tokens
        </span>
      )}
    </div>
  );
}
