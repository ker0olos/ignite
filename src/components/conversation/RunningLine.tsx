import { useSpinnerFrame } from "@/hooks/useSpinnerFrame";

/** A running call's collapsed output: a spinner, then "Running…". */
export function RunningLine() {
  const frame = useSpinnerFrame();
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-mono">{frame}</span>
      Running…
    </span>
  );
}
