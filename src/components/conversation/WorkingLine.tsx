import { useNow } from "@/hooks/useNow";
import { useSpinnerFrame } from "@/hooks/useSpinnerFrame";
import { elapsed } from "@/lib/runStep";

/** A terminal-style line for a run at work: spinner, current step, time since it began. */
export function WorkingLine({
  step = "Working",
  since,
}: {
  step?: string;
  since?: number;
}) {
  const frame = useSpinnerFrame();
  const now = useNow(1000);
  return (
    <>
      <span className="font-mono">{frame}</span>
      <span className="min-w-0 truncate font-mono">{step}</span>
      {since !== undefined && (
        <span className="shrink-0 text-muted-foreground/70 tabular-nums">
          {elapsed(now - since)}
        </span>
      )}
    </>
  );
}
