import type { ReactNode } from "react";
import { useSpinnerFrame } from "@/hooks/useSpinnerFrame";

/** A running call's collapsed output: a spinner, "Running…", then `children` (its line count). */
export function RunningLine({ children }: { children?: ReactNode }) {
  const frame = useSpinnerFrame();
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-mono">{frame}</span>
      Running…{children}
    </span>
  );
}
