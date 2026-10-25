import { useState } from "react";
import { FastForward } from "lucide-react";

/** Under "Waiting for fork": the conversation takes messages again, and its forks send it no report. */
export function StopForkWaitButton({
  stop,
}: {
  /** False when nothing held it any more. */
  stop: () => Promise<boolean>;
}) {
  const [stopping, setStopping] = useState(false);
  return (
    <button
      type="button"
      disabled={stopping}
      onClick={() => {
        setStopping(true);
        void stop().then((stopped) => stopped || setStopping(false));
      }}
      className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      <FastForward className="size-3" />
      {stopping ? "Stopping…" : "Stop waiting"}
    </button>
  );
}
