import { useSpinnerFrame } from "@/hooks/useSpinnerFrame";

/** Shown under a tool call that runs with nothing to show yet. */
export function RunningLine() {
  const frame = useSpinnerFrame();
  return (
    <p className="flex items-center gap-1.5">
      <span className="font-mono">{frame}</span>
      Running…
    </p>
  );
}
