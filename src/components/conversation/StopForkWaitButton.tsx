import { useState } from "react";
import { FastForward } from "lucide-react";

/** Under "Waiting for fork": the conversation takes messages again, and its forks send it no report. */
export function StopForkWaitButton({ stop }: { stop: () => Promise<boolean> }) {
  const [stopping, setStopping] = useState(false);
  return (
    <button
      type="button"
      disabled={stopping}
      onClick={() => {
        setStopping(true);
        // Once stopped, the next agents push unmounts it; offered again if it doesn't.
        void stop().finally(() => setStopping(false));
      }}
      className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      <FastForward className="size-3" />
      {stopping ? "Stopping…" : "Stop waiting"}
    </button>
  );
}
